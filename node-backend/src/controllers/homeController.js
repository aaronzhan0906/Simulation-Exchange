import HomeModel from "../models/homeModel.js";

class HomeController {
    async getSymbols(req, res) {
        try {
            const symbols = await HomeModel.getSymbols();
            console.log(symbols);
            res.status(200).json({
                "ok": true,
                "symbols": symbols.map(symbol => ({
                    symbolId: symbol.symbol_id,
                    symbolName: symbol.name,
                    imageUrl: symbol.image_url
                }))
            });
        } catch(error) {
            console.error("HomeController.getSymbols", error);

        };
    }
}

export default new HomeController();

