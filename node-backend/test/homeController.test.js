import { jest } from "@jest/globals";


const mockLogger = { // Mock logger object
    error: jest.fn() 
};

const mockHomeModel = { // Mock HomeModel object
    getSymbols: jest.fn() 
};

// the same as jest.mock with two differences: the factory function is required and it can be sync or async
jest.unstable_mockModule("../src/app.js", () => ({ // Mock the app.js module 
    logger: mockLogger
}));

jest.unstable_mockModule("../src/models/homeModel.js", () => ({ // Mock the homeModel.js module
    default: mockHomeModel
}));

describe("HomeController", () => {
    let HomeController;

    beforeEach(async () => {
        jest.clearAllMocks(); 
        const module = await import("../src/controllers/homeController.js");
        HomeController = module.default;
    });

    it("should return symbols successfully", async () => {
        // Arrange
        mockHomeModel.getSymbols.mockResolvedValue([ // Set up the mock return value for getSymbols
        { symbol_id: 1, name: "btc", image_url: "http://example.com/btc.png" }
        ]);

        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(), // Mock the return value to allow chaining
            json: jest.fn() 
        };

        // ACT // EXECUTE THE FUNCTION
        await HomeController.getSymbols(req, res);

        // ASSERTIONS
        expect(mockHomeModel.getSymbols).toHaveBeenCalled(); 
        expect(res.status).toHaveBeenCalledWith(200); 
        expect(res.json).toHaveBeenCalledWith({ 
            ok: true,
            message: "Get symbols successfully",
            data: [{
                symbolId: 1,
                symbolName: "btc",
                imageUrl: "http://example.com/btc.png"
            }]
        });
    });
});