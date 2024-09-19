## Simu Exchange

Website URL : https://simuexchange.online/

Simu Exchange is a simulated trading platform which offers simulated trading, matching engine and implementing a market maker to auto-generate order book depth.

<img width="100%" alt="SIMU-image" src="https://github.com/user-attachments/assets/61d0298c-316d-4a2a-b667-936a7bb9d06d">


## Features
* Each user receives 10,000 USDT in simulated funds after registration.
* Automated market maker system creates simulated buy and sell orders based on real-time prices.
* Provides a matching engine to obtain the best prices.
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
    * Provides real-time view of open orders.
    * Allows viewing and filtering of historical order records.
<br
   
## Architecture
<img width="100%" alt="SIMU-Architecture" src="https://github.com/user-attachments/assets/013a2143-19a2-4b55-a1d8-fe77b8973e7c">
<br>

## Techniques Highlights
* Built the backend system using **Node.js / Express** as the core framework.
* Utilized **Kafka** for real-time data processing with multiple topics for different data streams.
* **Python** was employed for the matching engine to handle order matching logic.
* Developed the market-making strategy using **Node.js** and automated its operation with **PM2**.
* **RDS / MySQL** stores normalized (3NF/2NF) data. Indexing optimizes queries; foreign keys ensure integrity.
* **Redis** is used for storing historical data, real-time data, and order books, optimizing read/write speeds.
* Implemented **WebSocket** with rooms for targeted real-time data and trade result pushing.
* Implemented containerized deployment using **Docker-Compose** and deployed on **EC2**.
* **S3** and **CloudFront** are utilized for image storage and distribution.
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
- Route 53
- S3
- CloudFront
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
#### Third-Party API
- Binance API
<br>

## Database Schema

<img width="100%" alt="SIMU-db schema" src="https://github.com/user-attachments/assets/45130944-16e4-4cb4-9c80-575a0a105960">
<br>

## Order Book Mechanism
* Sorted by price
* First-in-first-out within the same price level
<img width="70%" alt="SIMU-Order Book Schema" src="https://github.com/user-attachments/assets/e6e4c412-5e1d-4dae-8336-e4c23eb28f7c">

<sub>Image source: Xu, Alex; Lam, Sahn. System Design Interview – An Insider's Guide: Volume 2 (pp. 577). ByteByteGo Inc. Kindle Edition. </sub>
<br>
<br>

## Matching Mechanism of Matching Engine
Find the best price, execute the trade if matched, otherwise enter the order book.
<img width="100%" alt="SIMU-ME flow chart" src="https://github.com/user-attachments/assets/fce19d59-4222-4d10-831d-8f8e32cef761">

<br>

## Datastructure of Matching Engine
* **SortedDict**
    * Automatically sorts a dictionary based on price.
    * Retrieve the minimum/maximum price in O(1).
    * Insert, delete, and search operations in O(log n).
* **deque**
    * At each price level, when matching orders, remove from the front; for new orders, add them to the back.
    * Head and tail operations in O(1).
* **index**
    * Uses the order ID as the key.
    * Deletion operation in O(1).
<br>

| Operation | Time Complexity |
|-----------|-----------------|
| Get Best Price | O(1) |
| Insert | O(log n) |
| Match | O(n * m) |
| Delete | O(1) |

<sub>n: Number of price levels</sub>
<br>
<sub>m: Number of orders at a single price level</sub>
<br>
