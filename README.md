## Simu Exchange

Website URL : https://simuexchange.online/

Simu Exchange is a simulated trading platform which offers simulated trading, matching engine and implementing a market maker to auto-generate order book depth.
<br>
<img width="100%" alt="SIMU-Architecture" src="https://github.com/user-attachments/assets/f748cd4f-f990-4538-8739-835793b4b318">


<br>
<br>

The following is a test account, but it's recommended to register new account yourself to receive  10,000 USDT in simulated funds and enjoy a more completed experience!


```code
Test Account: test@gmail.com
Test Password: test
```

## Demo Video


https://github.com/user-attachments/assets/5875bc97-b8ed-4737-97f8-c4544d3b1d39




<br>


## Features
* Each user receives 10,000 USDT in simulated funds after registration.
* Provides a matching engine to obtain the best prices.
* Automated market maker system creates simulated buy and sell orders based on real-time prices.
* Home Page
    * Offers cryptocurrency selection with real-time prices and 24-hour price changes.
* Trade Page
    * Enables users to place limit orders.
    * Provides 30-day historical price data.
    * Displays real-time price data.
    * Shows real-time order book status.
    * Offers a real-time view of open orders with instant updates on trade status.
    * Displays real-time trade prices.
* Wallet Page
    * Allows viewing of historical profits.
    * Displays owned assets.
    * Calculate total assets and profits based on real-time prices every 3 seconds
* History Page
    * Displays a real-time view of open orders with filtering options.
    * Allows viewing and filtering of historical order records.
<br>


   
## Architecture
<img width="100%" alt="SIMU-Architecture" src="https://github.com/user-attachments/assets/4ce9c0ee-9191-4715-806c-06acf1a86d9c">

<br>

## Technique Highlights
* Built the backend system using **Node.js / Express** as the core framework.
* Utilized **Kafka** for real-time data processing with multiple topics for different data streams.
* **Python** was employed for the matching engine to handle order matching logic.
* Developed the market-making strategy using **Node.js** and automated its operation with **PM2**.
* **RDS / MySQL** stores normalized 3NF data. Indexing optimizes queries; foreign keys ensure integrity.
* Utilized **Transaction** and **SELECT ... FOR UPDATE** for concurrency control in data updates.
* **Redis** is used for storing historical data, real-time data, and order books, optimizing read/write speeds.
* Implemented **WebSocket** with rooms for targeted real-time data and trade result pushing.
* Implemented containerized deployment using **Docker Compose** and deployed on **EC2**.
* **S3** and **CloudFront** are utilized for image storage and distribution.
* Uses **JWT** for authentication, with access tokens and refresh tokens for session management.
* Integrated with the Binance API for real-time market data and 30 days of historical data.
<br>


## Backend Technique
#### Backend
- Node.js / Express
- Python
- Kafka
- WebSocket
#### Database
- MySQL
- Redis
#### Cloud Service (AWS)
- EC2
- RDS
- Route 53
- CloudFront
- S3
#### Containerization
- Docker
- Docker-compose
#### Authentication and Authorization 
- JWT
#### Infrastructure
- Nginx
- SSL(CertBot)
- pm2
- npm
#### Testing
- Postman
- Jest
#### Third-Party API
- Binance API
<br>

## Database Schema
<img width="1119" alt="SIMU-db schema" src="https://github.com/user-attachments/assets/47b4d17a-28b7-4e44-9745-fe526392fe57">
<br>

## Order Book Mechanism
* Sorted by price
* First-in-first-out within the same price level
<img width="70%" alt="SIMU-Order Book Schema" src="https://github.com/user-attachments/assets/e6e4c412-5e1d-4dae-8336-e4c23eb28f7c">

<sub>Image source: Xu, Alex; Lam, Sahn. System Design Interview – An Insider's Guide: Volume 2 (pp. 577). ByteByteGo Inc. Kindle Edition. </sub>
<br>
<br>

## Matching Mechanism of Matching Engine
Find the best price for the new order; execute the trade if matched; otherwise, enter the order into the order book.
<img width="100%" alt="SIMU-ME flow chart" src="https://github.com/user-attachments/assets/fce19d59-4222-4d10-831d-8f8e32cef761">

<br>

## Data Structure of Matching Engine
* **SortedDict**
    * Automatically sorts a dictionary based on price.
    * Retrieve the minimum/maximum price in O(1).
    * Insert, delete, and search operations in O(log n).
* **Dictionary**
    * Since Python version 3.7, dictionary order is guaranteed to be insertion order.   
    * A dict is used for each price level.
    * FIFO (First In, First Out).
<br>

| Operation | Time Complexity |
|-----------|-----------------|
| Get Best Price | O(1) |
| Insert | O(log n) |
| Match | O(n * m) |
| Delete | O(log n) |

<sub>n: Number of price levels</sub>
<br>
<sub>m: Number of orders at a single price level</sub>
<br>
