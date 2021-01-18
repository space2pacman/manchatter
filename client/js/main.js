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
				text: "",
				status: "public",
				invalid: false,
				maxNameLength: 30
			}
		}
	},
	methods: {
		roomAdd() {
			if(this.$root.room.id === null) {
				this.room.name = "";
				this.room.text = "";
				this.room.status = "public";
				this.room.invalid = false;
				this.$bvModal.show("room-add");
			}
		},
		getRoomBadge(status) {
			switch(status) {
				case "public":
					return "badge-success"
				case "privat":
					return "badge-danger";
			}
		},
		onModalRoomAdd(event) {
			let payload = {
				name: this.room.name,
				status: this.room.status,
				userId: this.$root.user.id
			}

			event.preventDefault();

			if(payload.name.length === 0) {
				this.room.invalid = true;
				this.room.text = "Название должно состоять минимум из 1-ого символа";
			} else {
				this.$root.socket.emit("room:add", payload);
			}

		},
		onRoomAdded(response) {
			if(response.status === "success") {
				this.room.text = "";
				this.room.invalid = false;
				this.$bvModal.hide("room-add");
			}

			if(response.status === "failed") {
				this.room.invalid = true;
				this.room.text = response.message;
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
			this.room.text = "";
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

Vue.component("users", {
	template: "#users"
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

			if(payload.text.length > 0) {
				this.text = "";
				this.$root.socket.emit("message:send", payload);
			}
		}
	},
	template: "#message"
});

let app = new Vue({
	el: "#app",
	data: {
		app: "chat",
		isAuth: false,
		socket: null,
		timer: null,
		room: {
			id: null,
			name: null,
			online: null,
			users: null,
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
			state: null,
			activity: null,
			maxDowntime: 60,
			login: {
				value: "",
				status: "",
				invalid: false,
				maxLoginLength: 20
			}
		}
	},
	watch: {
		"user.login.value"() {
			this.user.login.invalid = false;
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
			let payload = {
				query: `id=${this.user.id}`
			}

			this.socket = new io(`${this.api.socket.address}:${this.api.socket.port}`, payload);
			this.socket.on("connected", this.onConnected);
			this.socket.on("logout", this.onLogout);
			this.socket.on("room:added", this.onRoomAdded);
			this.socket.on("room:updated", this.onRoomUpdated);
			this.socket.on("room:refreshed", this.onRoomRefreshed);
			this.socket.on("room:joined", this.onRoomJoined);
			this.socket.on("room:left", this.onRoomLeft);
			this.socket.on("message:received", this.onMessageReceived);
			this.socket.on("user:updated", this.onUserUpdated);
			this.socket.on("ping", this.onPing);
		},
		reset() {
			this.isAuth = false;
			this.user.id = null;
			this.room.id = null;
			this.room.name = null;
			this.room.status = null;
			this.room.messages = null;
			this.room.online = null;
			this.room.users = null;
			this.rooms = null;
			this.socket.close();
			this.socket = null;
			this.user.login.value = "";
			this.user.activity = null;
			this.clearLocalStorage();
			this.setHash();
			this.stopUpdate();
		},
		roomJoin(roomId) {
			let payload = {
				userId: this.user.id,
				roomId
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
			this.socket.emit("room:update");
		},
		roomRefresh() {
			let payload = {
				roomId: this.room.id
			}

			this.socket.emit("room:refresh", payload);
		},
		userUpdate() {
			let start = this.user.activity;
			let end = Date.now();
			let downtime = Math.floor((end - start) / 1000);
			let payload = {
				userId: this.user.id,
				state: null
			}

			if(downtime >= this.user.maxDowntime) {
				this.user.state = "idle";
			} else {
				this.user.state = "online";
			}

			payload.state = this.user.state;
			this.socket.emit("user:update", payload);
		},
		onAuth(response) {
			if(response.status === "success") {
				this.user.login.status = "";
				this.user.login.invalid = false;
				this.user.id = response.data.userId;
				this.user.login.value = response.data.login;
				this.setLocalStorage("userId", this.user.id);
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
				this.user.activity = Date.now();
				this.roomUpdate();
				this.checkHash();
				this.startUpdate();
			}

			if(response.status === "failed") {
				this.isAuth = false;
				this.reset();
			}
		},
		onLogout(response) {
			if(response.status === "success") {
				this.reset();
			}

			if(response.status === "failed") {
				this.isAuth = true;
			}
		},
		onRoomAdded(response) {
			if(response.status === "success") {
				if(response.data.login === this.user.login.value) {
					this.roomJoin(response.data.room.id);
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
				this.room.users = response.data.users;
			}
		},
		onRoomJoined(response) {
			if(response.status === "success") {
				if(response.data.login === this.user.login.value) {
					this.room.id = response.data.id;
					this.room.name = response.data.name;
					this.room.status = response.data.status;
					this.room.messages = response.data.messages;
					this.room.online = response.data.online;
					this.room.users = response.data.users;
					this.setHash(this.room.id);
					this.roomUpdate();
				} else {
					this.roomRefresh();
				}
			}

			if(response.status === "failed") {
				this.setHash();
			}
		},
		onRoomLeft(response) {
			if(response.status === "success") {
				if(response.data.login === this.user.login.value) {
					this.room.id = null;
					this.room.name = null;
					this.room.status = null;
					this.room.messages = null;
					this.room.online = null;
					this.room.users = null;
					this.setHash();
					this.roomUpdate();
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
		onUserUpdated(response) {
			if(response.status === "success") {
				this.roomRefresh();
			}
		},
		onPing() {
			this.socket.emit("pong");
		},
		onHashChange(event) {
			let chatId = window.location.hash.slice(1);

			if(chatId) {
				this.roomJoin(chatId);
			}

		},
		onWindowClick() {
			if(this.socket) {
				this.user.activity = Date.now();
				this.userUpdate();
			}
		},
		onCheckUserId(response) {
			if(response.status === "success") {
				this.user.id = response.data.userId;
				this.user.login.value = response.data.login;
				this.connect();
			}

			if(response.status === "failed") {
				this.clearLocalStorage();
			}
		},
		setHash(hash) {
			if(hash) {
				window.location.hash = `#${hash}`;
			} else {
				window.location.hash = "";
			}
		},
		checkHash() {
			let chatId = window.location.hash.slice(1);

			if(chatId) {
				this.roomJoin(chatId);
			}
		},
		checkUserId() {
			let payload = {
				userId: this.getLocalStorage("userId")
			}

			if(payload.userId) {
				this.request("user/check-id", payload).then(this.onCheckUserId);
			}
		},
		setLocalStorage(key, value) {
			let payload;

			if(localStorage[this.app]) {
				payload = JSON.parse(localStorage[this.app]);
			} else {
				payload = {};
			}

			payload[key] = value;
			localStorage[this.app] = JSON.stringify(payload);
		},
		getLocalStorage(key) {
			if(localStorage[this.app]) {
				let data = JSON.parse(localStorage[this.app]);

				if(data[key]) {
					return data[key];
				} else {
					return false;
				}
			} else {
				return false;
			}
		},
		clearLocalStorage() {
			delete localStorage[this.app];
		},
		startUpdate() {
			this.timer = setInterval(() => {
				this.roomUpdate();
				this.userUpdate();
			}, 1000);
		},
		stopUpdate() {
			clearInterval(this.timer);
		},
		translate(message) {
			let messages = {
				"user already exists": "Пользователь уже существует",
				"room already exists": "Комната с таким названием уже существует",
				"name is empty": "Название должно состоять минимум из 1-ого символа",
				"login is empty": "Имя пользователя должно состоять минимум из 1-ого символа",
				"you are in the room": "Вы находитесь в комнате",
				"max login length exceeded": "Превышена максимальная длина логина",
				"max name length exceeded": "Превышена максимальная длина имени"
			}

			return messages[message] ? messages[message] : message;
		}
	},
	mounted() {
		this.checkUserId();
		window.addEventListener("hashchange", this.onHashChange);
		window.addEventListener("click", this.onWindowClick);
	}
})