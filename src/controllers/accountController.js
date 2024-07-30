import Big from "big.js";
import Account from ("../models/Account");
import Transaction from "../models/Transaction";

class AccountController {
    static async getBalance(req, res) {
        try {
            const account = await Account.findById(req.user.id);
            res.json({ balance: account.balance.toString() });
        } catch (error) {
            res.status(500).json({ error: "Failed to retrieve balance"});
        }
    }

    static async preAuthorization(req, res) {
        try {
            const { amount } = req.body;
            const account = await Account.findById(req.user.id);
            const balance = new Big(account.balance);
            const preAuthAmount = new Big(amount);
            
            if (balance.lt(preAuthAmount)){
                return res.status(400).json({ error: "Insufficient balance"})
            }

            account.pendingTransactions.push({ amount: preAuthAmount.toString(), type: "preauth" });
            await account.save();
            
            const remainingBalance = balance.minus(preAuthAmount);
            res.json({
                ok: true,
                message: "Pre-authorization successful",
                remainingBalance: remainingBalance.toString()
            });
        } catch (error) {
            res.status(500).json({error: "Pre-authorization failed"})
        }
    }

    static async completeTransaction(req, res){
        try {
            const { actualAmount, transactionType } = req.body;
            const account = await Account.findById(req.user.id);
            const balance = new Big(account.balance);
            const amount = new Big(actualAmount);

            let newBalance;
            if (transactionType === "buy") {
                newBalance = balance.minus(amount);
            } else if (transactionType === "sell") {
                newBalance = balance.plus(amount);
            } else {
                return res.status(400).json({ error: "Invalid transaction type"})
            }
            
            account.balance = newBalance.toString();

            const transaction = new Transaction({
                accountId: req.user.id,
                amount: amount.toString(),
                type: transactionType
            });

            await Promise.all([account.save(), transaction.save()]);

            res.json({
                ok: true,
                message: "Transaction completed successfully",
                newBalance: account.balance
            });
        } catch(error) {
            res.status(500).json({ error: "Transaction failed" });
        }
    }

    // static async getCurrentAssets(req, res) { }
}


export default AccountController;