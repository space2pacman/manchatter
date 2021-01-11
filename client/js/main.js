Vue.component("auth", {
	template: "#auth"
});

Vue.component("chat", {
	template: "#chat"
});

Vue.component("navbar", {
	data() {
		return {
			room: {
				name: "",
				status: "",
				invalid: false
			}
		}
	},
	methods: {
		roomAdd() {
			if(this.$root.room.id === null) {
				this.room.name = "";
				this.room.status = "";
				this.room.invalid = false;
				this.$bvModal.show("room-add");
			}
		},
		onModalRoomAdd(event) {
			let payload = {
				name: this.room.name,
				userId: this.$root.user.id
			}

			event.preventDefault();

			if(payload.name.length === 0) {
				this.room.invalid = true;
				this.room.status = "Название должно состоять минимум из 1-ого символа";
			} else {
				this.$root.socket.emit("room:add", payload);
			}

		},
		onRoomAdded(response) {
			if(response.status === "success") {
				this.room.status = "";
				this.room.invalid = false;
				this.$bvModal.hide("room-add");
			}

			if(response.status === "failed") {
				this.room.invalid = true;
				this.room.status = response.message;
			}
		},
		logout() {
			let payload = {
				userId: this.$root.user.id
			}

			this.$root.socket.emit("logout", payload);
		}
	},
	watch: {
		"room.name"() {
			this.room.status = "";
			this.room.invalid = false;
		}
	},
	mounted() {
		this.$root.socket.on("room:added", this.onRoomAdded);
	},
	template: "#navbar"
});

Vue.component("rooms", {
	template: "#rooms"
});

Vue.component("messages", {
	methods: {
		scroll() {
			this.$nextTick(() => {
				this.$refs["chat-messages"].scroll(0, this.$refs["chat-messages"].scrollHeight);
			})
		}
	},
	watch: {
		"$root.room.messages"() {
			this.scroll();
		}
	},
	mounted() {
		this.$root.socket.on("message:received", response => {
			if(response.status === "success") {
				this.scroll();
			}
		})
	},
	template: "#messages"
});

Vue.component("message", {
	data() {
		return {
			text: ""
		}
	},
	methods: {
		sendMessage() {
			let payload = {
				userId: this.$root.user.id,
				text: this.text
			}

			this.text = "";
			this.$root.socket.emit("message:send", payload);
		}
	},
	template: "#message"
});

let app = new Vue({
	el: "#app",
	data: {
		isAuth: false,
		socket: null,
		room: {
			id: null,
			name: null,
			online: null,
			messages: []
		},
		rooms: null,
		api: {
			http: {
				address: window.location.origin,
				port: 80
			},
			socket: {
				address: window.location.origin,
				port: 8081
			}
		},
		user: {
			id: null,
			login: {
				value: "",
				status: "",
				invalid: false
			}
		}
	},
	methods: {
		request(url, data) {
			return fetch(`${this.api.http.address}:${this.api.http.port}/${url}`, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json"
				},
				body: JSON.stringify(data)
			}).then(response => {
				return response.json();
			});
		},
		auth() {
			let payload = {
				login: this.user.login.value
			}

			if(payload.login.length === 0) {
				this.user.login.invalid = true;
				this.user.login.status = "Имя пользователя должно состоять минимум из 1-ого символа";
			} else {
				this.request("auth", payload).then(this.onAuth);
			}

		},
		connect() {
			this.socket = new io(`${this.api.socket.address}:${this.api.socket.port}`, {
				query: `id=${this.user.id}`
			});

			this.socket.on("connected", this.onConnected);
			this.socket.on("logout", this.onLogout);
			this.socket.on("room:added", this.onRoomAdded);
			this.socket.on("room:updated", this.onRoomUpdated);
			this.socket.on("room:refreshed", this.onRoomRefreshed);
			this.socket.on("room:joined", this.onRoomJoined);
			this.socket.on("room:left", this.onRoomLeft);
			this.socket.on("message:received", this.onMessageReceived);
		},
		roomJoin(room) {
			let payload = {
				userId: this.user.id,
				roomId: room.id
			}

			this.socket.emit("room:join", payload);
		},
		roomLeave() {
			let payload = {
				userId: this.user.id,
				roomId: this.room.id
			}
			
			this.socket.emit("room:leave", payload);
		},
		roomUpdate() {
			if(this.socket) {
				this.socket.emit("room:update");
			}
		},
		roomRefresh() {
			let payload = {
				roomId: this.room.id
			}

			this.socket.emit("room:refresh", payload);
		},
		onAuth(response) {
			if(response.status === "success") {
				this.user.login.status = "";
				this.user.login.invalid = false;
				this.user.id = response.user.id;
				this.connect();
			}

			if(response.status === "failed") {
				this.user.login.invalid = true;
				this.user.login.status = response.message;
			}
		},
		onConnected(response) {
			if(response.status === "success") {
				this.isAuth = true;
				this.roomUpdate();
			}

			if(response.status === "failed") {
				this.isAuth = false;
			}
		},
		onLogout(response) {
			if(response.status === "success") {
				this.isAuth = false;
				this.user.id = null;
				this.room.id = null;
				this.room.name = null;
				this.room.messages = null;
				this.room.online = null;
				this.user.login.value = "";
			}

			if(response.status === "failed") {
				this.isAuth = true;
			}
		},
		onRoomAdded(response) {
			if(response.status === "success") {
				if(response.data.login === this.user.login.value) {
					this.roomJoin(response.data.room);
				}

				this.roomUpdate();
			}
		},
		onRoomUpdated(response) {
			if(response.status === "success") {
				this.rooms = response.data;
			}
		},
		onRoomRefreshed(response) {
			if(response.status === "success") {
				this.room.online = response.data.online;
			}
		},
		onRoomJoined(response) {
			if(response.status === "success") {
				if(response.data.login === this.user.login.value) {
					this.room.id = response.data.id;
					this.room.name = response.data.name;
					this.room.messages = response.data.messages;
					this.room.online = response.data.online;
				} else {
					this.roomRefresh();
				}
			}
		},
		onRoomLeft(response) {
			if(response.status === "success") {
				if(response.data.login === this.user.login.value) {
					this.room.id = null;
					this.room.name = null;
					this.room.messages = null;
					this.room.online = null;
				} else {
					this.roomRefresh();
				}
			}
		},
		onMessageReceived(response) {
			if(response.status === "success") {
				this.room.messages.push(response.data);
			}
		},
		translate(message) {
			let messages = {
				"user already exists": "Пользователь уже существует",
				"room already exists": "Комната с таким названием уже существует",
				"name is empty": "Название должно состоять минимум из 1-ого символа",
				"login is empty": "Имя пользователя должно состоять минимум из 1-ого символа",
				"you are in the room": "Вы находитесь в комнате"
			}

			return messages[message] ? messages[message] : message;
		}
	},
	mounted() {
		setInterval(() => {
			this.roomUpdate();
		}, 1000);
	}
})