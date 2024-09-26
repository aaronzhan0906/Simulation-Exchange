import { jest } from "@jest/globals";

// Mock dependencies
const mockTradeModel = {
    createOrder: jest.fn(),
    getAvailableBalanceById: jest.fn(),
    lockBalance: jest.fn(),
    getQuantityBySymbolAndUserId: jest.fn(),
    lockAsset: jest.fn()
};

const mockKafkaProducer = {
    sendMessage: jest.fn().mockResolvedValue()
};

const mockWebSocketService = {
  sendToUser: jest.fn()
};

const mockGenerateSnowflakeId = jest.fn();

const mockLogger = {
  error: jest.fn()
};

// Mock modules
jest.unstable_mockModule("../src/models/tradeModel.js", () => ({ default: mockTradeModel }));
jest.unstable_mockModule("../src/services/kafkaProducer.js", () => ({ default: mockKafkaProducer }));
jest.unstable_mockModule("../src/services/websocketService.js", () => ({ default: mockWebSocketService }));
jest.unstable_mockModule("../src/utils/snowflake.js", () => ({ generateSnowflakeId: mockGenerateSnowflakeId }));
jest.unstable_mockModule("../src/app.js", () => ({ logger: mockLogger }));

describe("TradeController - createOrder without ws and kafka", () => {
    let TradeController;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module = await import("../src/controllers/tradeController.js");
        TradeController = module.default;
    });

    it("should create an order successfully", async () => {
        // Arrange
        const req = {
            body: {
                symbol: "btc_usdt",
                side: "buy",
                type: "limit",
                price: "50000",
                quantity: "0.1"
            },
            user: { userId: "123" }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const mockOrderId = "1234567899876543210";
        const mockOrder = {
            order_id: mockOrderId,
            user_id: "123",
            symbol: "btc_usdt",
            side: "buy",
            type: "limit",
            price: "50000",
            quantity: "0.1",
            status: "open",
            created_at: new Date().toISOString()
        };

        mockGenerateSnowflakeId.mockReturnValue(mockOrderId);
        mockTradeModel.getAvailableBalanceById.mockResolvedValue("100000");
        mockTradeModel.lockBalance.mockResolvedValue(true);
        mockTradeModel.createOrder.mockResolvedValue(mockOrder);

        // Act
        await TradeController.createOrder(req, res);

        // Assert
        expect(mockTradeModel.getAvailableBalanceById).toHaveBeenCalledWith("123");
        expect(mockTradeModel.lockBalance).toHaveBeenCalledWith("123", "50000", "0.1");
        expect(mockTradeModel.createOrder).toHaveBeenCalledWith(
            mockOrderId,
            "123",
            "btc_usdt",
            "buy",
            "limit",
            "50000",
            "0.1",
            "open"
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            ok: true,
            message: "Order created successfully"
        });
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