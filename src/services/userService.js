import db from "../config/database.js";

class UserService {
    async createUser(userData) {
        const { displayname, email, password } = userData;
    const command = "INSERT INTO users (displayname, email, password) VALUES (?, ?, ?)";
    const result = await db.query(command, [displayname, email, password]);
    return result.insertId;
    };

    async getUserByEmail(email) {
        const command = "SELECT user_id, displayname, email, password FROM users WHERE email = ?";
        const result = await db.query(command, [email]);
        return result;
    }
}


export default new UserService();