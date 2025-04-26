const WalletTransaction = require('../../models/WalletTransaction');
const User = require('../../models/User');
const mongoose=require('mongoose');


const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

exports.getWalletTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const searchQuery = req.query.search || '';

    let query = {};
    if (searchQuery) {
      const users = await User.find({
        $or: [
          { name: { $regex: escapeRegex(searchQuery), $options: 'i' } },
          { email: { $regex: escapeRegex(searchQuery), $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(user => user._id);
      const conditions = [];

      if (mongoose.Types.ObjectId.isValid(searchQuery)) {
        conditions.push({ _id: searchQuery });
      }
      if (userIds.length > 0) {
        conditions.push({ user_id: { $in: userIds } });
      }

      if (conditions.length > 0) {
        query.$or = conditions;
      } else {
        query._id = null;
      }
    }

    const transactions = await WalletTransaction.find(query)
      .populate('user_id', 'name email')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ created_at: -1 });

    const totalTransactions = await WalletTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    const totalWalletBalance = await User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$wallet' } } }
    ]);

    const usersWithWallet = await User.countDocuments({ wallet: { $gt: 0 }, isActive: true });
    const usersWithoutWallet = await User.countDocuments({ wallet: 0, isActive: true });

    res.render('wallet/wallet_transactions', {
      transactions,
      searchQuery,
      currentPage: page,
      totalPages,
      title: 'Wallet Transactions',
      totalWalletBalance: totalWalletBalance[0]?.total || 0,
      usersWithWallet,
      usersWithoutWallet
    });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    req.flash('error', 'An error occurred while fetching transactions.');
    res.redirect('/admin/wallet-transactions');
  }
};

exports.getSearchSuggestions = async (req, res) => {
  try {
    const query = req.query.q ? escapeRegex(req.query.q) : '';
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    })
      .select('name email')
      .limit(5);

    let transactions = [];
    if (mongoose.Types.ObjectId.isValid(query)) {
      transactions = await WalletTransaction.find({
        _id: query
      })
        .select('_id')
        .limit(5);
    }

    const suggestions = [
      ...users.map(user => ({ text: user.name, type: 'user' })),
      ...users.map(user => ({ text: user.email, type: 'user' })),
      ...transactions.map(tx => ({ text: tx._id.toString(), type: 'transaction' }))
    ]
      .filter((v, i, a) => a.findIndex(t => t.text === v.text) === i)
      .slice(0, 10);

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.json([]);
  }
};

exports.getTransactionDetails = async (req, res) => {
  try {
    const transactionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      req.flash('error', 'Invalid transaction ID.');
      return res.redirect('/admin/wallet-transactions');
    }

    const transaction = await WalletTransaction.findById(transactionId)
      .populate('user_id', 'name email');

    if (!transaction) {
      req.flash('error', 'Transaction not found.');
      return res.redirect('/admin/wallet-transactions');
    }

    res.render('wallet/transaction_details', {
      transaction,
      title: 'Transaction Details'
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    req.flash('error', 'An error occurred while fetching transaction details.');
    res.redirect('/admin/wallet-transactions');
  }
};