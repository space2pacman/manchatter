let uuid = require("uuid");
let EventEmitter = require("events");
let config = require(".././utils/config");

class User extends EventEmitter {
	constructor(login) {
		super();
		this.id = uuid.v4();
		this.login = login;
		this.socket = null;
		this.roomId = null;
		this.pulse = null;
		this._start = 0;
		this._end = 0;
		this._SECOND = 1000;
		this._latency;
		this._timeout = config.user.timeout;
	}

	stopPulse() {
		clearInterval(this.pulse);
	}

	ping() {
		setTimeout(() => {
			this.socket.emit("ping");
		}, 1000);
	}

	hearbeat(callback) {
		this.socket.on("pong", this.onPong.bind(this));
		this.pulse = setInterval(this.onPulse.bind(this), 1000);
	}

	roomLeave(room) {
		if(room) {
			let payload = {
				status: null,
				message: null,
				data: null
			}

			payload.status = "success";
			payload.data = {
				login: this.login
			}

			room.users.forEach(user => {
				user.socket.emit("room:left", payload);
			});
		}
	}

	onPong() {
		this._end = Date.now();
		this.ping();
	}

	onPulse() {
		if(this._end > 0) {
			this._start = Date.now();
			this._latency = Math.floor((this._start - this._end) / this._SECOND);

			if(this._latency >= this._timeout) {
				this.emit("pulse:stop");
			}
		}
	}
}

module.exports = User;