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
	rooms: {
		default: ["general", "test", "dev"]
	}
}