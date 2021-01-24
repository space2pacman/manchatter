let uuid = require("uuid");
let EventEmitter = require("events");
let users = require("./Users");
let config = require("./../utils/config");

class Room extends EventEmitter {
	constructor(name, status, securited) {
		super();
		this.id = uuid.v4();
		this.name = name;
		this.status = status || "public";
		this.securited = securited || false;
		this.users = [];
		this.messages = [];
		this._lastTimeOnline = 0;
		this._timer = null;
		this._init();
	}

	addMessage(userId, text) {
		let user = users.find("id", userId);
		let data = {
			userId: user.id,
			login: user.login,
			date: Date.now(),
			text
		}

		this.messages.push(data);

		return this.messages[this.messages.length - 1];
	}

	getLastMessage(userId) {
		let message;
		
		for(let i = this.messages.length - 1; i >= 0; i--) {
			if(this.messages[i].userId === userId) {
				message = this.messages[i];

				break;
			}
		}

		return message || null;
	}

	_init() {
		if(!this.securited) {
			let timer = setInterval(() => {
				if(this.users.length === 0) {
					if(this._lastTimeOnline === 0) {
						this._lastTimeOnline = Date.now();
					}
				} else {
					this._lastTimeOnline = 0;
				}

				if(this._lastTimeOnline > 0 && ((Date.now() - this._lastTimeOnline) / 1000) > config.room.timeout) {
					let payload = {
						roomId: this.id
					}

					this.emit("room:remove", payload);
					clearInterval(timer);
				}
			}, 1000)
		}
	}
}

module.exports = Room;