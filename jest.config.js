export default {
  moduleDirectories: ["node_modules", "node-backend", "src"], // Specifies additional locations to search when resolving modules
  roots: ["<rootDir>/node-backend"], // Specifies the root directory for Jest to search for tests
  testEnvironment: "node", // The tests will run in a Node.js environment
  testMatch: ["**/node-backend/test/**/*.test.js"], // Pattern to match test file
  testPathIgnorePatterns: ["/dist/"] //  Exclude compiled files in dist folder
};