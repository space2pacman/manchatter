let User = require("./User");

class Users {
	constructor() {
		this._users = [];
	}

	add(login) {
		let user = new User(login);

		this._users.push(user);

		return user;
	}

	remove(id) {
		let user = this.find("id", id);

		if(user) {
			let index = this._users.indexOf(user);
			
			this._users.splice(index, 1);

			return true;
		} else {
			return false;
		}
	}

	find(key, value) {
		let user = this._users.find(user => user[key] === value);

		if(user) {
			return user;
		} else {
			return null;
		}
	}
}

module.exports = new Users();