module.exports = {
	port: {
		http: 80,
		socket: 8081
	},
	socket: {
		cors: {
			origin: "*"
		}
	},
	room: {
		default: ["general", "test", "dev"],
		maxNameLength: 30,
		timeout: 300,
		message: {
			delay: 1
		}
	},
	user: {
		timeout: 30,
		maxLoginLength: 20
	}
}