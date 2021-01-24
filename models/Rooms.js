let EventEmitter = require("events");
let config = require("./../utils/config");
let users = require("./Users");
let Room = require("./Room");

class Rooms {
	constructor() {
		this._rooms = {};
		this._emitter = new EventEmitter();
		this._init();
	}

	add(name, status, securited) {
		let room = new Room(name, status, securited);

		room.on("room:remove", this._onRoomRemove.bind(this));
		
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

	remove(roomId) {
		if(this._rooms[roomId].securited === false) {
			delete this._rooms[roomId];
		}
	}

	_onRoomRemove(response) {
		this.remove(response.roomId);
	}

	_init() {
		config.room.default.forEach(room => {
			this.add(room, "public", true);
		});
	}
}

module.exports = new Rooms();