import HomeModel from "../models/homeModel.js";
import { logger } from "../app.js";

class HomeController {
    async getSymbols(req, res) {
        try {
            const symbols = await HomeModel.getSymbols();
            
            res.status(200).json({
                "ok": true,
                message: "Get symbols successfully",
                "data": symbols.map(symbol => ({
                    symbolId: symbol.symbol_id,
                    symbolName: symbol.name,
                    imageUrl: symbol.image_url
                }))
            });
        } catch(error) {
            logger.error(`[getSymbols]: ${error}`)
            throw error;
        };
    }
}

export default new HomeController();

