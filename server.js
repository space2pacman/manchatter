let express = require("express");
let fs = require("fs");
let bodyParser = require("body-parser");
let socketServer = require("socket.io");
let users = require("./models/Users");
let rooms = require("./models/Rooms");
let config = require("./utils/config");
let app = express();
let io = socketServer(config.port.socket, config.socket);

app.use("/public", express.static("client"));
app.use(bodyParser.json());

app.get("/", (request, response) => {
	fs.readFile("./client/index.html", (error, data) => {
		if(error) throw error;
		
		response.set("Content-Type", "text/html");
		response.status(200).send(data.toString());
	})
})

app.post("/check-id", (request, response) => {
	let user = users.find("id", request.body.userId);
	let payload = {
		status: null,
		message: null,
		data: null
	}

	if(user) {
		payload.status = "success";
		payload.data = {
			login: user.login
		}
		response.status(200).send(payload);
	} else {
		payload.status = "failed";
		payload.message = "user not found";
		response.status(403).send(payload);
	}
})

app.post("/auth", (request, response) => {
	let login = request.body.login;
	let payload = {
		status: null,
		message: null,
		data: null
	}

	if(login.length === 0) {
		payload.status = "failed";
		payload.message = "login is empty";
		response.status(403).send(payload);
	} else if(users.find("login", login) === null) {
		let user = users.add(login);

		payload.status = "success";
		payload.message = "user added";
		payload.data = {
			userId: user.id,
			login: user.login
		};
		response.status(200).send(payload);
	} else {
		payload.status = "failed";
		payload.message = "user already exists";
		response.status(403).send(payload);
	}
});

io.on("connection", socket => {
	let id = socket.handshake.query.id;
	let user = users.find("id", id);
	let payload = {
		status: null,
		message: null,
		data: null
	}

	if(user) {
		user.socket = socket;
		payload.status = "success";
	} else {
		payload.status = "failed";
	}

	socket.emit("connected", payload);

	socket.on("logout", response => {
		let user = users.find("id", response.userId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		if(user.roomId !== null) {
			roomLeave(user);
		}

		if(users.remove(user.id)) {
			payload.status = "success";
		} else {
			payload.status = "failed";
		}
		
		socket.emit("logout", payload);
	});

	socket.on("room:add", response => {
		let user = users.find("id", response.userId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		if(user.roomId !== null) {
			payload.status = "failed";
			payload.message = "you are in the room";
		} else if(response.name.length === 0) {
			payload.status = "failed";
			payload.message = "name is empty";
		} else if(rooms.find("name", response.name) === null) {
			payload.status = "success";
			payload.data = {
				login: user.login,
				room: rooms.add(response.name)
			};
		} else {
			payload.status = "failed";
			payload.message = "room already exists";
		}

		io.emit("room:added", payload);
	});

	socket.on("room:update", response => {
		let payload = {
			status: null,
			message: null,
			data: null
		}

		payload.status = "success";
		payload.data = rooms.getAll();
		socket.emit("room:updated", payload);
	});

	socket.on("room:refresh", response => {
		let room = rooms.find("id", response.roomId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		payload.status = "success";
		payload.data = {
			online: room.users.length
		}

		socket.emit("room:refreshed", payload);
	})

	socket.on("room:join", response => {
		let user = users.find("id", response.userId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		if(user.roomId !== null) {
			roomLeave(user);
		}

		let room = rooms.join(user.id, response.roomId);

		user.roomId = response.roomId;
		payload.status = "success";
		payload.data = {
			login: user.login,
			id: room.id,
			name: room.name,
			messages: room.messages,
			online: room.users.length
		}

		room.users.forEach(user => {
			user.socket.emit("room:joined", payload);
		});
	});

	socket.on("room:leave", response => {
		let user = users.find("id", response.userId);
		let room = rooms.leave(user.id, user.roomId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		user.roomId = null;
		payload.status = "success";
		payload.data = {
			login: user.login
		}

		room.users.forEach(user => {
			user.socket.emit("room:left", payload);
		});

		socket.emit("room:left", payload);
	});

	socket.on("message:send", response => {
		let user = users.find("id", response.userId);
		let room = rooms.find("id", user.roomId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		if(user.roomId) {
			payload.status = "success";
			payload.data = rooms.addMessage(user.id, user.roomId, response.text);
			room.users.forEach(user => {
				user.socket.emit("message:received", payload);
			});
		}
	});

	function roomLeave(user) {
		let room = rooms.leave(user.id, user.roomId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		payload.status = "success";
		payload.data = {
			login: user.login
		}

		room.users.forEach(user => {
			user.socket.emit("room:left", payload);
		});
	}
});

app.listen(config.port.http, () => console.log(`Server listen on port: ${config.port.http}`));