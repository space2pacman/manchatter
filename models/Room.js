let uuid = require("uuid");
let users = require("./Users");

class Room {
	constructor(name, status, securited) {
		this.id = uuid.v4();
		this.name = name;
		this.status = status || "public";
		this.securited = securited || false;
		this.users = [];
		this.messages = [];
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
}

module.exports = Room;