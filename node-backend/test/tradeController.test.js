import { jest } from "@jest/globals";

const mockTradeModel = {
    createOrder: jest.fn(),
};

const mockKafkaProducer = {
    sendMessage: jest.fn().mockResolvedValue()
};

const mockWebSocketService = {
    sendToUser: jest.fn()
};

const mockQuoteService = {
    logOrderBookSnapshot: jest.fn(),
    updatePriceData: jest.fn()
};

const mockGenerateSnowflakeId = jest.fn();

const mockLogger = {
    error: jest.fn()
};

jest.unstable_mockModule("../src/models/tradeModel.js", () => ({ 
    default: mockTradeModel 
}));

jest.unstable_mockModule("../src/services/kafkaProducer.js", () => ({ 
    default: mockKafkaProducer 
}));

jest.unstable_mockModule("../src/services/websocketService.js", () => ({ 
    default: mockWebSocketService 
}));

jest.unstable_mockModule("../src/utils/snowflake.js", () => ({ 
    generateSnowflakeId: mockGenerateSnowflakeId 
}));

jest.unstable_mockModule("../src/app.js", () => ({ 
    logger: mockLogger 
}));

jest.unstable_mockModule("../src/services/quoteService.js", () => ({ 
    default: mockQuoteService,
    logOrderBookSnapshot: mockQuoteService.logOrderBookSnapshot,
    updatePriceData: mockQuoteService.updatePriceData  
}));


describe("TradeController - createOrder", () => {
    let TradeController;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await import("../src/controllers/tradeController.js");
        TradeController = module.default;
    });

    it("should return 400 if required fields are missing", async () => {
        // Arrange
        const req = {
            body: {
                symbol: "btc_usdt",
                side: "buy",
                type: "limit",
                // missing price and quantity
            },
            user: { userId: "123" }
        };
    
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    
        // Act 
        await TradeController.createOrder(req, res);
    
        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: true,
            message: "Missing required fields!"
        });
    });

    it("should return 400 if price or quantity isn't greater than 0", async () => {
        const req = {
            body: {
                symbol: "btc_usdt",
                side: "buy",
                type: "limit",
                price: "0",
                quantity: "-1"
            },
            user: { userId: "123" }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await TradeController.createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: true,
            message: "Price and quantity must be greater than 0"
        })
    });

});