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

app.post("/user/check-id", (request, response) => {
	let user = users.find("id", request.body.userId);
	let payload = {
		status: null,
		message: null,
		data: null
	}

	if(user) {
		payload.status = "success";
		payload.data = {
			login: user.login,
			userId: user.id
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
	} else if(login.length >= config.user.maxLoginLength) {
		payload.status = "failed";
		payload.message = "max login length exceeded";
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
		payload.status = "success";
		user.socket = socket;
		user.state = "online";
		user.stopPulse();
		user.hearbeat();
		user.ping();
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
			user.roomLeave(rooms.leave(user.id, user.roomId));
		}

		user.stopPulse();

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
		} else if(response.name.length >= config.room.maxNameLength) {
			payload.status = "failed";
			payload.message = "max name length exceeded";
		} else if(rooms.find("name", response.name) === null) {
			payload.status = "success";
			payload.data = {
				login: user.login,
				room: rooms.add(response.name, response.status)
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
		payload.data = rooms.getAll("public");
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
			online: room.users.length,
			users: room.users.map(user => { return { state: user.state, login: user.login } })
		}

		socket.emit("room:refreshed", payload);
	})

	socket.on("room:join", response => {
		let user = users.find("id", response.userId);
		let room = rooms.find("id", response.roomId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		if(user && user.roomId !== null) {
			user.roomLeave(rooms.leave(user.id, user.roomId));
		}

		if(room) {
			rooms.join(user.id, room.id);
			user.roomId = room.id;
			payload.status = "success";
			payload.data = {
				login: user.login,
				id: room.id,
				name: room.name,
				status: room.status,
				messages: room.messages,
				online: room.users.length,
				users: room.users.map(user => { return { state: user.state, login: user.login } })
			}
			room.users.forEach(user => {
				user.socket.emit("room:joined", payload);
			});
		} else {
			payload.status = "failed";
			payload.message = "room not found";
			user.socket.emit("room:joined", payload);
		}
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

		if(room) {
			payload.status = "success";
			payload.data = rooms.addMessage(user.id, user.roomId, response.text);
			room.users.forEach(user => {
				user.socket.emit("message:received", payload);
			});
		}
	});

	socket.on("user:update", response => {
		let user = users.find("id", response.userId);
		let room = rooms.find("id", user?.roomId);
		let payload = {
			status: null,
			message: null,
			data: null
		}

		if(room) {
			payload.status = "success";
			user.state = response.state;
			room.users.forEach(user => {
				user.socket.emit("user:updated", payload);
			});
		}

	})

	socket.on("disconnect", () => {
		if(user && user.roomId) {
			user.roomLeave(rooms.leave(user.id, user.roomId));
			user.removeAllListeners("pulse:stop");
		}
	})

	if(user) {
		user.on("pulse:stop", () => {
			if(user.roomId !== null) {
				user.roomLeave(rooms.leave(user.id, user.roomId));
			}

			user.stopPulse();
			users.remove(user.id);
		});
	}
});

app.listen(config.port.http, () => console.log(`Server listen on port: ${config.port.http}`));