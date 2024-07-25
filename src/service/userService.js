import db from "../config/database.js";

class UserService {
    async createUser(userData) {
        const { displayname, email, password } = userData;
    const command = "INSERT INTO users (displayname, email, password) VALUES (?, ?, ?)";
    const result = await db.query(command, [displayname, email, password]);
    return result.insertId;
    };

    async getUserById(id) {
        const command = "SELECT id, username, email FROM users WHERE id = ?";
        const result = await db.query(command, [id]);
        return users[0];
    }


}


export default UserService();