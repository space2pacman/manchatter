let uuid = require("uuid");

class Room {
	constructor(name, status, securited) {
		this.id = uuid.v4();
		this.name = name;
		this.status = status || "public";
		this.securited = securited || false;
		this.users = [];
		this.messages = [];
	}
}

module.exports = Room;