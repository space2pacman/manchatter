let config = require("./../utils/config");
let users = require("./Users");
let Room = require("./Room");

class Rooms {
	constructor() {
		this._rooms = {};
		this._init();
	}

	add(name, status, securited) {
		let room = new Room(name, status, securited);

		this._rooms[room.id] = room;

		return room;
	}

	find(key, value) {
		let values = Object.values(this._rooms);
		let result = values.find(room => room[key] === value);

		if(result) {
			return result;
		} else {
			return null;
		}
	}

	join(userId, roomId) {
		let user = users.find("id", userId);

		this._rooms[roomId].users.push(user);

		return this._rooms[roomId];
	}

	leave(userId, roomId) {
		let user = users.find("id", userId);
		let index = this._rooms[roomId].users.indexOf(user);

		if(index !== -1) {
			this._rooms[roomId].users.splice(index, 1);
		}

		return this._rooms[roomId];
	}

	addMessage(userId, roomId, text) {
		let user = users.find("id", userId);
		let data = {
			login: user.login,
			text
		}

		this._rooms[roomId].messages.push(data);

		return this._rooms[roomId].messages[this._rooms[roomId].messages.length - 1];
	}

	getAll(status) {
		let rooms = [];

		for(let id in this._rooms) {
			let room = this._rooms[id];

			if(room.status === status) {
				rooms.push({ id: room.id, name: room.name, status: room.status, online: room.users.length });
			}
		}

		return rooms.length > 0 ? rooms : null;
	}

	_init() {
		config.room.default.forEach(room => {
			this.add(room, "public", true);
		})
	}
}

module.exports = new Rooms();