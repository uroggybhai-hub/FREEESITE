/**
 * =========================================================================
 * PREMIUM STORE - USER APP LOGIC (app.js)
 * Features: Firebase Sync, Telegram SDK, Monetag Ads, 10s Task Tracker,
 *           Daily Bonus, Image Notifications, Auto Discount Calculation
 * =========================================================================
 */

// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBv2Um04tsv8z2XItB4j-gLb9yU5qDyogU",
    authDomain: "all-time-18453.firebaseapp.com",
    databaseURL: "https://all-time-18453-default-rtdb.firebaseio.com",
    projectId: "all-time-18453",
    storageBucket: "all-time-18453.firebasestorage.app",
    messagingSenderId: "102266317328",
    appId: "1:102266317328:web:4696ae769dae2b081c3895"
};]

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Global Firebase References
const db = firebase.database();
const auth = firebase.auth();
const tg = window.Telegram.WebApp;

// ==========================================
// 2. GLOBAL STATE VARIABLES
// ==========================================
let currentUser = null;       // Stores logged-in user's Firebase data
let currentTgUser = null;     // Stores Telegram user context
let allFiles = [];            // Cache for approved files
let allBanners = [];          // Cache for active banners
let activeTask = null;        // Used for 10-second task tracker

/**
 * ==========================================
 * 3. CORE APP INITIALIZATION & AUTHENTICATION
 * ==========================================
 */
async function initApp(isIndex = false) {
    try {
        // 3.1 Initialize Telegram WebApp SDK
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0f172a'); // Match Dark Theme UI
        tg.setBackgroundColor('#0f172a');
        
        // 3.2 Extract User Context (Fallback for local browser testing)
        currentTgUser = tg.initDataUnsafe?.user || {
            id: 123456789,
            first_name: "Demo",
            last_name: "User",
            username: "demo_user",
            photo_url: "https://via.placeholder.com/150"
        };

        // 3.3 Check for Referral parameter in Start URI
        let startParam = tg.initDataUnsafe?.start_param || null;

        // 3.4 Authenticate with Firebase Anonymously
        await auth.signInAnonymously();
        const userRef = db.ref('users/' + currentTgUser.id);
        
        // 3.5 Fetch or Create User Profile
        userRef.once('value', (snapshot) => {
            if (!snapshot.exists()) {
                // ---> Register New User
                let initialData = {
                    id: currentTgUser.id,
                    name: currentTgUser.first_name + (currentTgUser.last_name ? ' ' + currentTgUser.last_name : ''),
                    username: currentTgUser.username || 'No Username',
                    photo: currentTgUser.photo_url || 'https://via.placeholder.com/150',
                    balance: 0,
                    role: 'user', // Default role
                    joinedAt: Date.now(),
                    purchased: [],
                    completedTasks: [],
                    referredBy: startParam,
                    lastDailyDate: ''
                };
                userRef.set(initialData);

                // ---> Handle Referral Bonus System (Referrer gets +10 coins)
                if (startParam && startParam != currentTgUser.id) {
                    const refUser = db.ref('users/' + startParam);
                    refUser.once('value', refSnap => {
                        if(refSnap.exists()) {
                            refUser.update({ balance: firebase.database.ServerValue.increment(10) });
                        }
                    });
                }
                currentUser = initialData;
            } else {
                // ---> Existing User Loaded
                currentUser = snapshot.val();
                if(!currentUser.purchased) currentUser.purchased = [];
                if(!currentUser.completedTasks) currentUser.completedTasks = [];
            }

            // 3.6 Redirect Logic based on page
            if (isIndex) {
                if (currentUser.role === 'admin') {
                    window.location.replace('admin.html');
                } else if (currentUser.role === 'banned') {
                    document.body.innerHTML = `<h1 style="color:red; text-align:center; margin-top:50px;">YOUR ACCOUNT IS BANNED</h1>`;
                } else {
                    window.location.replace('user.html');
                }
            } else {
                // If on user.html, initialize the dashboard UI
                setupUserPanel();
            }
        });

    } catch (error) {
        console.error("Initialization Error:", error);
        showToast("Error connecting to secure server.");
    }
}

/**
 * ==========================================
 * 4. UI SETUP & REALTIME DATA BINDING
 * ==========================================
 */
function setupUserPanel() {
    // Hide loading screen smoothly
    setTimeout(() => {
        const loader = document.getElementById('main-loader');
        if(loader) loader.style.display = 'none';
    }, 800);

    // 4.1 Real-time Balance Listener (Updates instantly on change)
    db.ref('users/' + currentTgUser.id + '/balance').on('value', snap => {
        let bal = snap.val() || 0;
        currentUser.balance = bal;
        
        // Update DOM elements dynamically
        if(document.getElementById('top-balance')) document.getElementById('top-balance').innerText = bal;
        if(document.getElementById('earn-balance')) document.getElementById('earn-balance').innerText = bal;
        if(document.getElementById('profile-balance')) document.getElementById('profile-balance').innerText = bal;
    });

    // 4.2 Populate Profile Details
    if(document.getElementById('profile-pic')) document.getElementById('profile-pic').src = currentUser.photo;
    if(document.getElementById('profile-name')) document.getElementById('profile-name').innerText = currentUser.name;
    if(document.getElementById('drawer-avatar')) document.getElementById('drawer-avatar').src = currentUser.photo;
    if(document.getElementById('drawer-name')) document.getElementById('drawer-name').innerText = currentUser.name;
    
    // 4.3 Setup Referral Link
    if(document.getElementById('ref-link')) {
        document.getElementById('ref-link').value = `https://t.me/Codeify_Codes_Store_Robot?start=${currentTgUser.id}`;
    }
    
    // 4.4 Provide Admin Panel Access if authorized
    if(currentUser.role === 'admin' && document.getElementById('admin-panel-btn')) {
        document.getElementById('admin-panel-btn').classList.remove('hidden');
    }

    // 4.5 Initialize all data streams
    loadBanners();
    loadFiles();
    loadTasks();
    loadSupportChat();
    loadUserUploads();
    loadPurchased();
    loadNotifications();
}

/**
 * ==========================================
 * 5. NAVIGATION & MODAL CONTROLLERS
 * ==========================================
 */
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Remove active state from bottom nav icons
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Show Target Tab
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    // Telegram Haptic Feedback (Light Tap)
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function toggleDrawer() {
    const drawer = document.querySelector('.drawer');
    const overlay = document.querySelector('.drawer-overlay');
    drawer.classList.toggle('open');
    overlay.classList.toggle('open');
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('rigid');
}

function openModal(id) { 
    document.getElementById(id).style.display = 'flex'; 
    if(tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}

function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    t.classList.remove('hidden');
    
    if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        t.classList.add('hidden');
    }, 3000);
}

/**
 * ==========================================
 * 6. HOME PAGE & FILE RENDERER
 * ==========================================
 */
function loadBanners() {
    db.ref('banners').on('value', snap => {
        let html = '';
        snap.forEach(child => {
            let b = child.val();
            if(b.status === 'approved') {
                html += `<img src="${b.image}" onclick="window.open('${b.link}')" style="cursor:pointer; display:none;" alt="Ad Banner">`;
            }
        });
        
        const container = document.getElementById('ad-slider');
        if(!container) return;

        if(html === '') {
            container.innerHTML = `<div class="flex-center h-100 text-muted glass">No Active Ads Available</div>`;
        } else {
            container.innerHTML = html;
            initSlider(container);
        }
    });
}

function initSlider(container) {
    let imgs = container.getElementsByTagName('img');
    if(imgs.length > 0) {
        let idx = 0;
        imgs[0].style.display = 'block';
        setInterval(() => {
            imgs[idx].style.display = 'none';
            idx = (idx + 1) % imgs.length;
            imgs[idx].style.display = 'block';
        }, 3500); // 3.5 seconds interval
    }
}

function loadFiles() {
    db.ref('files').on('value', snap => {
        allFiles = [];
        let html = '';
        snap.forEach(child => {
            let f = child.val();
            f.id = child.key;
            // Only show globally approved files
            if(f.status === 'approved') {
                allFiles.push(f);
                html += renderFileCard(f);
            }
        });
        
        if(document.getElementById('home-file-grid')) {
            document.getElementById('home-file-grid').innerHTML = html || `<p class="text-muted w-100 text-center mt-2">No files published yet.</p>`;
        }
        if(document.getElementById('search-file-grid')) {
            document.getElementById('search-file-grid').innerHTML = html;
        }
    });
}

function renderFileCard(f) {
    return `
    <div class="file-card glass" onclick="showFileDetails('${f.id}')">
        <img src="${f.image}" alt="Cover Image" loading="lazy">
        <h4 class="text-white">${f.name}</h4>
        <div class="flex space-between items-center mt-1">
            <span class="price text-gradient"><i class="fas fa-coins text-warning"></i> ${f.sellPrice}</span>
            <span class="text-xs bg-primary text-white rounded px-1">${f.category}</span>
        </div>
    </div>`;
}

function filterCat(cat) {
    // Reset buttons UI
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Filter array
    let filtered = cat === 'All' ? allFiles : allFiles.filter(f => f.category === cat);
    document.getElementById('home-file-grid').innerHTML = filtered.map(renderFileCard).join('') || `<p class="text-muted text-center w-100 mt-2">No files found in ${cat} category.</p>`;
    
    if(tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
}

function searchFiles() {
    let q = document.getElementById('searchInput').value.toLowerCase();
    let filtered = allFiles.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
    document.getElementById('search-file-grid').innerHTML = filtered.map(renderFileCard).join('') || `<p class="text-muted text-center mt-2 w-100">No matching files found.</p>`;
}

/**
 * ==========================================
 * 7. FILE PURCHASE & DETAILS LOGIC
 * ==========================================
 */
function showFileDetails(id) {
    let f = allFiles.find(x => x.id === id);
    if(!f) return;
    
    document.getElementById('detail-img').src = f.image;
    document.getElementById('detail-title').innerText = f.name;
    document.getElementById('detail-sell').innerText = f.sellPrice;
    document.getElementById('detail-real').innerText = f.realPrice;
    document.getElementById('detail-desc').innerText = f.desc;
    document.getElementById('detail-category').innerText = `Category: ${f.category}`;
    
    // Auto Calculate Discount
    let discount = Math.round(((f.realPrice - f.sellPrice) / f.realPrice) * 100);
    let discountEl = document.getElementById('detail-discount');
    if(discount > 0) {
        discountEl.innerText = `${discount}% OFF`;
        discountEl.style.display = 'inline-block';
    } else {
        discountEl.style.display = 'none';
    }

    let actionDiv = document.getElementById('detail-action');
    
    // Check Ownership to toggle Download / Buy button
    if(currentUser.purchased && currentUser.purchased.includes(id)) {
        actionDiv.innerHTML = `
            <button class="btn-success w-100 p-2 text-lg shadow-lg flex-center gap-1" onclick="downloadFile('${f.link}')">
                <i class="fas fa-cloud-download-alt"></i> Download File
            </button>`;
    } else {
        actionDiv.innerHTML = `
            <button class="btn-gradient w-100 p-2 text-lg shadow-lg" onclick="buyFile('${id}')">
                Pay ${f.sellPrice} Coins to Buy
            </button>`;
    }
    openModal('fileDetailsModal');
}

function downloadFile(link) {
    if(tg.openLink) { 
        tg.openLink(link); 
    } else { 
        window.open(link, '_blank'); 
    }
}

function buyFile(id) {
    let f = allFiles.find(x => x.id === id);
    
    // Security Check: Low Balance
    if(currentUser.balance < f.sellPrice) {
        showToast("Insufficient Coins! Earn more on the Earn Page.");
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        return;
    }
    
    /**
     * REVENUE SPLIT LOGIC:
     * Seller gets 60% of sell price.
     * Platform keeps 40%.
     */
    let sellerEarning = Math.floor(f.sellPrice * 0.6);
    
    // 1. Deduct Full Price from Buyer
    db.ref('users/' + currentTgUser.id + '/balance').set(firebase.database.ServerValue.increment(-f.sellPrice));
    
    // 2. Pay Seller (If it's not uploaded by admin directly)
    if (f.ownerId && f.ownerId !== 'admin') {
        db.ref('users/' + f.ownerId + '/balance').set(firebase.database.ServerValue.increment(sellerEarning));
    }
    
    // 3. Save File to User's Purchased Library
    let purchased = currentUser.purchased || [];
    purchased.push(id);
    db.ref('users/' + currentTgUser.id + '/purchased').set(purchased);
    currentUser.purchased = purchased; // Update Local Cache
    
    showToast("Purchase Successful! Item added to Profile.");
    closeModal('fileDetailsModal');
    loadPurchased(); // Refresh Library
}

/**
 * ==========================================
 * 8. EARN SYSTEM (ADS, DAILY, TASKS)
 * ==========================================
 */
function watchAd() {
    // Using Monetag Rewarded Ads SDK
    if (typeof show_10576842 === 'function') {
        show_10576842().then(() => {
            // Reward User upon success
            db.ref('users/' + currentTgUser.id + '/balance').set(firebase.database.ServerValue.increment(5));
            showToast("Awesome! +5 Coins Added to Wallet.");
        }).catch(e => {
            console.error("Ad Engine Error:", e);
            showToast("No ads available right now. Please try again later.");
        });
    } else {
        showToast("Ad system is initializing. Please wait...");
    }
}

function claimDaily() {
    let today = new Date().toDateString(); // Generates date like "Thu May 28 2026"
    
    // Prevent double claim
    if (currentUser.lastDailyDate === today) {
        showToast("You already claimed today! Come back tomorrow.");
        if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        return;
    }

    // Provide Reward (6 Coins)
    db.ref('users/' + currentTgUser.id).update({ 
        lastDailyDate: today,
        balance: firebase.database.ServerValue.increment(6)
    });
    
    currentUser.lastDailyDate = today;
    showToast("Daily Bonus Claimed Successfully! +6 Coins.");
}

/**
 * ==========================================
 * 9. SMART TASK SYSTEM (10 SECONDS TRACKER)
 * ==========================================
 */
function loadTasks() {
    db.ref('tasks').on('value', snap => {
        let html = '';
        let completed = currentUser.completedTasks || []; 
        
        snap.forEach(child => {
            let t = child.val();
            // Show only tasks that user has NOT completed
            if (!completed.includes(child.key)) {
                html += `
                <div class="list-item glass flex space-between items-center">
                    <div>
                        <h4 class="text-white">${t.name}</h4>
                        <p class="text-sm text-warning mt-1"><i class="fas fa-coins"></i> +${t.reward} Coins</p>
                    </div>
                    <button class="btn-gradient" style="padding: 10px 25px;" onclick="startTask('${child.key}', ${t.reward})">Go</button>
                </div>`;
            }
        });
        
        document.getElementById('tasks-list').innerHTML = html || `<div class="glass p-2 text-center text-muted w-100">All tasks completed! Check back later.</div>`;
    });
}

function startTask(id, reward) {
    let completed = currentUser.completedTasks || [];
    if (completed.includes(id)) {
        showToast("Task has already been completed!");
        return;
    }
    
    // Required Custom Task URL
    let link = 'https://omg10.com/4/10621080';
    
    // Execute Link Opening
    if(tg.openLink) {
        tg.openLink(link);
    } else {
        window.open(link, '_blank');
    }

    // Initialize Timer Tracker State
    activeTask = { id, reward, startTime: Date.now() };
    showToast("Wait at least 10 seconds on the page to verify task!");
}

// Global Event Listener for tracking return time (10s logic)
document.addEventListener("visibilitychange", () => {
    // If user returns to the app and a task is active
    if (document.visibilityState === "visible" && activeTask) {
        // Calculate seconds spent away
        let timeSpent = (Date.now() - activeTask.startTime) / 1000;
        
        if (timeSpent >= 10) {
            // Task Successful
            db.ref('users/' + currentTgUser.id + '/balance').set(firebase.database.ServerValue.increment(activeTask.reward));
            
            // Log Task as Completed
            let completed = currentUser.completedTasks || [];
            completed.push(activeTask.id);
            db.ref('users/' + currentTgUser.id + '/completedTasks').set(completed);
            currentUser.completedTasks = completed;
            
            showToast(`Task Verified! +${activeTask.reward} Coins added.`);
            loadTasks(); // Update UI to remove task
        } else {
            // Task Failed - Returned too early
            showToast(`Task Failed! You returned in ${Math.round(timeSpent)}s. You must wait full 10s.`);
            if(tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        }
        
        // Reset Tracker
        activeTask = null; 
    }
});

/**
 * ==========================================
 * 10. USER FORM SUBMISSIONS
 * ==========================================
 */
function submitFile() {
    let data = {
        name: document.getElementById('add-file-name').value.trim(),
        image: document.getElementById('add-file-img').value.trim(),
        link: document.getElementById('add-file-link').value.trim(),
        sellPrice: Number(document.getElementById('add-file-price').value),
        realPrice: Number(document.getElementById('add-file-real-price').value),
        category: document.getElementById('add-file-cat').value,
        desc: document.getElementById('add-file-desc').value.trim(),
        ownerId: currentTgUser.id,
        status: 'pending', // Requires admin approval
        timestamp: Date.now()
    };

    if(!data.name || !data.image || !data.link || !data.sellPrice || !data.category) {
        return showToast("Please fill all required inputs correctly.");
    }
    
    db.ref('files').push(data);
    showToast("File Request Submitted! Pending Admin Approval.");
    
    // Clear Input Form
    document.querySelectorAll('#addFileModal input, #addFileModal textarea').forEach(el => el.value = '');
    closeModal('addFileModal');
}

function submitAdBanner() {
    let data = {
        name: document.getElementById('ad-name').value.trim(),
        image: document.getElementById('ad-img').value.trim(),
        link: document.getElementById('ad-link').value.trim(),
        ownerId: currentTgUser.id,
        status: 'pending', // Requires admin approval
        timestamp: Date.now()
    };

    if(!data.name || !data.image || !data.link) {
        return showToast("Please fill all banner details.");
    }

    db.ref('banners').push(data);
    showToast("Ad Banner Request sent for review.");
    
    document.querySelectorAll('#adRunModal input').forEach(el => el.value = '');
    closeModal('adRunModal');
}

/**
 * ==========================================
 * 11. PROFILE DATA & LIBRARY
 * ==========================================
 */
function copyRef() {
    let el = document.getElementById('ref-link');
    el.select();
    document.execCommand('copy');
    showToast("Referral URL Copied to Clipboard!");
}

function loadUserUploads() {
    db.ref('files').orderByChild('ownerId').equalTo(currentTgUser.id).on('value', snap => {
        let html = '';
        snap.forEach(child => {
            let f = child.val();
            let statusClass = f.status === 'approved' ? 'text-success' : (f.status === 'rejected' ? 'text-danger' : 'text-warning');
            
            html += `
            <div class="list-item glass flex space-between items-center">
                <span class="font-bold text-white">${f.name}</span>
                <span class="text-xs ${statusClass} border-1 px-1 rounded">${f.status.toUpperCase()}</span>
            </div>`;
        });
        document.getElementById('user-uploads-list').innerHTML = html || "<p class='text-muted p-2 text-center'>You haven't submitted any files.</p>";
    });
}

function loadPurchased() {
    let purchased = currentUser.purchased || [];
    let html = '';
    
    purchased.forEach(id => {
        let f = allFiles.find(x => x.id === id);
        if(f) {
            html += `
            <div class="list-item glass flex space-between items-center">
                <div class="flex items-center gap-1">
                    <img src="${f.image}" style="width:50px;height:50px;border-radius:10px;object-fit:cover;">
                    <div>
                        <h4 class="text-sm text-white">${f.name}</h4>
                        <p class="text-xs text-primary">${f.category}</p>
                    </div>
                </div>
                <button class="btn-glass p-1 rounded-circle flex-center" style="width:40px;height:40px;" onclick="downloadFile('${f.link}')" title="Download">
                    <i class="fas fa-cloud-download-alt text-lg text-success"></i>
                </button>
            </div>`;
        }
    });
    
    document.getElementById('purchased-list').innerHTML = html || "<div class='glass p-2 text-center text-muted mt-1 w-100'>Your library is empty. Buy files from Home.</div>";
}

/**
 * ==========================================
 * 12. REAL-TIME SUPPORT CHAT ENGINE
 * ==========================================
 */
function loadSupportChat() {
    const box = document.getElementById('chat-box');
    
    db.ref(`chats/${currentTgUser.id}/messages`).on('value', snap => {
        let html = '';
        snap.forEach(child => {
            let msg = child.val();
            let isMe = msg.sender === 'user';
            
            // Format external links dynamically
            let text = msg.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#ffd600; text-decoration:underline;">$1</a>');
            
            html += `<div class="msg-bubble ${isMe ? 'msg-self' : 'msg-other'}">${text}</div>`;
        });
        
        box.innerHTML = html || `<div class="text-center text-muted mt-2">Start a conversation with Admin for help.</div>`;
        
        // Auto Scroll to latest message
        setTimeout(() => box.scrollTop = box.scrollHeight, 100);
    });
}

function sendMessage() {
    let inp = document.getElementById('chat-input');
    let text = inp.value.trim();
    if(!text) return;
    
    // Prepare Data
    let msgData = { text, sender: 'user', timestamp: Date.now() };
    
    // Push Msg to DB
    db.ref(`chats/${currentTgUser.id}/messages`).push(msgData);
    
    // Update Profile Meta for Admin View Sorting
    db.ref(`chats/${currentTgUser.id}`).update({ 
        lastMessage: text, 
        timestamp: Date.now(),
        name: currentUser.name, 
        photo: currentUser.photo 
    });
    
    // Reset Input
    inp.value = '';
}

/**
 * ==========================================
 * 13. NOTIFICATION ENGINE (WITH IMAGE SUPPORT)
 * ==========================================
 */
function loadNotifications() {
    // Only load latest 20 notifications to save memory
    db.ref('notifications').orderByChild('timestamp').limitToLast(20).on('value', snap => {
        let html = '';
        snap.forEach(child => {
            let n = child.val();
            let dateStr = new Date(n.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            
            // Handle Optional Image URL from Admin
            let imgHtml = n.image ? `<img src="${n.image}" class="w-100 rounded mt-1 shadow-lg" style="max-height: 160px; object-fit: cover;" alt="Notification Image">` : '';
            
            // Using prepending logic (variable + html) to show newest on top
            html = `
            <div class="list-item glass flex-col items-start mb-1">
                <div class="flex space-between items-center w-100">
                    <h4 class="text-gradient w-100"><i class="fas fa-bolt text-warning text-sm"></i> ${n.title}</h4>
                </div>
                <p class="text-sm mt-1 w-100 text-main">${n.desc}</p>
                ${imgHtml}
                <div class="w-100 text-right">
                    <small class="text-xs text-muted mt-1">${dateStr}</small>
                </div>
            </div>` + html; 
        });
        
        document.getElementById('notif-list').innerHTML = html || "<div class='glass p-2 text-center text-muted'>No notifications right now.</div>";
    });
}