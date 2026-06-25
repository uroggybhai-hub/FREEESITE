// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBv2Um04tsv8z2XItB4j-gLb9yU5qDyogU",
    authDomain: "all-time-18453.firebaseapp.com",
    databaseURL: "https://all-time-18453-default-rtdb.firebaseio.com",
    projectId: "all-time-18453",
    storageBucket: "all-time-18453.firebasestorage.app",
    messagingSenderId: "102266317328",
    appId: "1:102266317328:web:4696ae769dae2b081c3895"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
let activeAdminChatUser = null;

window.onload = () => { 
    setTimeout(() => {
        document.getElementById('admin-loader').style.display = 'none';
        switchAdminTab('dashboard');
    }, 1000);
};

// --- ISOLATED TAB SWITCHING LOGIC ---
function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.menu-item[data-target="${tabId}"]`).classList.add('active');

    const titles = {
        'dashboard': 'Dashboard Overview',
        'users': 'Manage Users',
        'admin-add-file': 'Upload New File', // NEW TAB
        'files': 'File Approvals',
        'banners': 'Ad Campaigns',
        'tasks': 'Daily Tasks',
        'messages': 'Support Center',
        'broadcast': 'Push Notifications'
    };
    document.getElementById('page-title').innerText = titles[tabId];

    if(window.innerWidth <= 768) {
        document.getElementById('admin-sidebar').classList.remove('open');
    }

    if(tabId === 'dashboard') loadStats();
    if(tabId === 'users') loadAdminUsers();
    if(tabId === 'files') loadAdminFiles('requests');
    if(tabId === 'banners') loadAdminBanners();
    if(tabId === 'messages') loadAdminChats();
    if(tabId === 'tasks') loadAdminTasks();
}

function toggleSidebar() { document.getElementById('admin-sidebar').classList.toggle('open'); }

// --- DASHBOARD ---
function loadStats() {
    db.ref('users').once('value', s => document.getElementById('stat-users').innerText = s.numChildren());
    db.ref('files').once('value', s => {
        let total = 0, pending = 0;
        s.forEach(c => { total++; if(c.val().status === 'pending') pending++; });
        document.getElementById('stat-files').innerText = total;
        document.getElementById('stat-pending').innerText = pending;
    });
    db.ref('banners').once('value', s => {
        let ads = 0;
        s.forEach(c => { if(c.val().status === 'approved') ads++; });
        document.getElementById('stat-banners').innerText = ads;
    });
}

// --- USERS ---
function loadAdminUsers(query = '') {
    db.ref('users').once('value', snap => {
        let html = '';
        snap.forEach(child => {
            let u = child.val();
            if(query && !u.name.toLowerCase().includes(query.toLowerCase())) return;
            html += `
            <div class="list-item flex-col items-start w-100">
                <div class="flex space-between items-center w-100 border-bottom pb-1 mb-1">
                    <div class="flex items-center gap-1">
                        <img src="${u.photo}" style="width:40px;height:40px;border-radius:50%; border:2px solid var(--primary)">
                        <div><strong>${u.name}</strong><br><span class="text-xs text-muted">ID: ${u.id}</span></div>
                    </div>
                    <div class="text-right"><h3 class="text-warning"><i class="fas fa-coins"></i> ${u.balance}</h3><span class="text-xs ${u.role==='banned' ? 'text-danger' : 'text-success'}">${u.role.toUpperCase()}</span></div>
                </div>
                <div class="flex gap-1 w-100">
                    <button class="btn-success w-100 flex-center" onclick="editBal('${child.key}', 100)">+ 100</button>
                    <button class="btn-warning w-100 flex-center" onclick="editBal('${child.key}', -100)">- 100</button>
                    ${u.role === 'banned' ? `<button class="btn-primary w-100 bg-primary" onclick="updateRole('${child.key}', 'user')">Unban</button>` : `<button class="btn-danger w-100" onclick="updateRole('${child.key}', 'banned')">Ban User</button>`}
                </div>
            </div>`;
        });
        document.getElementById('admin-user-list').innerHTML = html || "<p class='text-center'>No users found.</p>";
    });
}
function searchUsers(val) { loadAdminUsers(val); }
function editBal(uid, amount) { db.ref('users/' + uid + '/balance').set(firebase.database.ServerValue.increment(amount)); showToast("Balance Updated"); loadAdminUsers(); }
function updateRole(uid, role) { db.ref('users/' + uid + '/role').set(role); showToast("Role Updated"); loadAdminUsers(); }

// --- NEW: DIRECT ADMIN FILE UPLOAD LOGIC ---
function calcAdminDiscount() {
    let real = Number(document.getElementById('admin-file-real').value);
    let sell = Number(document.getElementById('admin-file-sell').value);
    let badge = document.getElementById('admin-discount-badge');
    
    if (real > 0 && sell > 0 && real > sell) {
        let discount = Math.round(((real - sell) / real) * 100);
        badge.innerText = discount + "% OFF";
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function adminSubmitFile() {
    let name = document.getElementById('admin-file-name').value.trim();
    let image = document.getElementById('admin-file-img').value.trim();
    let link = document.getElementById('admin-file-link').value.trim();
    let realPrice = Number(document.getElementById('admin-file-real').value);
    let sellPrice = Number(document.getElementById('admin-file-sell').value);
    let category = document.getElementById('admin-file-cat').value;
    let desc = document.getElementById('admin-file-desc').value.trim();

    if(!name || !image || !link || !realPrice || !sellPrice || !category) {
        return showToast("Please fill all required fields!");
    }

    db.ref('files').push({
        name, image, link, realPrice, sellPrice, category, desc,
        ownerId: 'admin', // identify as admin uploaded
        status: 'approved', // instantly published
        timestamp: Date.now()
    });

    showToast("File Uploaded & Published Successfully!");
    
    // Clear the form
    document.querySelectorAll('#admin-add-file input, #admin-add-file textarea, #admin-add-file select').forEach(el => el.value = '');
    document.getElementById('admin-discount-badge').classList.add('hidden');
}

// --- FILE APPROVALS ---
function toggleFileView(view) {
    document.getElementById('tab-req').className = view === 'requests' ? 'btn-gradient w-50' : 'btn-glass w-50';
    document.getElementById('tab-app').className = view === 'approved' ? 'btn-gradient w-50' : 'btn-glass w-50';
    loadAdminFiles(view);
}
function loadAdminFiles(view) {
    db.ref('files').on('value', snap => {
        let html = '';
        snap.forEach(child => {
            let f = child.val();
            if((view === 'requests' && f.status === 'pending') || (view === 'approved' && f.status === 'approved')) {
                html += `
                <div class="list-item flex-col">
                    <img src="${f.image}" class="w-100 mb-1" style="height:120px; object-fit:cover; border-radius:12px;">
                    <h4 class="text-white">${f.name}</h4>
                    <div class="flex space-between text-sm mt-1 mb-1 border-bottom pb-1"><span class="text-warning"><i class="fas fa-coins"></i> ${f.sellPrice}</span><span class="text-primary">${f.category}</span></div>
                    <div class="flex gap-1 w-100">
                        ${view === 'requests' ? `<button class="btn-success w-100" onclick="updateFileStatus('${child.key}', 'approved')"><i class="fas fa-check"></i> Accept</button><button class="btn-danger w-100" onclick="updateFileStatus('${child.key}', 'rejected')"><i class="fas fa-times"></i> Reject</button>` : `<button class="btn-danger w-100" onclick="deleteFile('${child.key}')"><i class="fas fa-trash"></i> Delete</button>`}
                    </div>
                </div>`;
            }
        });
        document.getElementById('admin-file-list').innerHTML = html || "<p class='text-muted'>No items.</p>";
    });
}
function updateFileStatus(fid, status) { db.ref('files/' + fid).update({status}); showToast(`File ${status}`); }
function deleteFile(fid) { if(confirm("Permanently delete?")) { db.ref('files/' + fid).remove(); showToast("Deleted"); } }

// --- BANNERS ---
function loadAdminBanners() {
    db.ref('banners').on('value', snap => {
        let html = '';
        snap.forEach(child => {
            let b = child.val();
            html += `<div class="list-item flex-col"><img src="${b.image}" class="w-100 rounded mb-1" style="height:100px; object-fit:cover;"><div class="flex space-between items-center w-100"><strong class="text-sm">${b.name}</strong><span>${b.status}</span></div><div class="flex gap-1 mt-1 w-100">${b.status === 'pending' ? `<button class="btn-success w-100" onclick="updateBannerStatus('${child.key}', 'approved')">Approve</button>` : ''}<button class="btn-danger w-100" onclick="deleteBanner('${child.key}')">Delete</button></div></div>`;
        });
        document.getElementById('admin-banner-list').innerHTML = html || "<p>No banners.</p>";
    });
}
function adminAddBanner() { let name=document.getElementById('admin-ad-name').value, image=document.getElementById('admin-ad-img').value, link=document.getElementById('admin-ad-link').value; if(!name||!image||!link) return showToast("Fill all"); db.ref('banners').push({name,image,link,status:'approved',timestamp:Date.now()}); showToast("Added!"); }
function updateBannerStatus(id, s) { db.ref('banners/'+id).update({status:s}); }
function deleteBanner(id) { db.ref('banners/'+id).remove(); }

// --- TASKS ---
function addTask() { let name=document.getElementById('task-name').value, reward=document.getElementById('task-reward').value; if(!name||!reward) return showToast("Error"); db.ref('tasks').push({name,reward:Number(reward)}); showToast("Task Added"); }
function loadAdminTasks() { db.ref('tasks').on('value', snap => { let html=''; snap.forEach(child => { html+=`<div class="list-item flex space-between items-center"><div><h4 class="text-white">${child.val().name}</h4><span class="text-warning">${child.val().reward} Coins</span></div><button class="btn-danger" onclick="db.ref('tasks/${child.key}').remove(); showToast('Deleted')">Remove</button></div>`; }); document.getElementById('admin-tasks-list').innerHTML = html; }); }

// --- CHATS ---
function loadAdminChats() { db.ref('chats').on('value', snap => { let html=''; snap.forEach(child => { let chat = child.val(); if(!chat.lastMessage) return; html+=`<div class="list-item cursor-pointer" onclick="openAdminChat('${child.key}', '${chat.name}')"><div class="flex items-center gap-1"><img src="${chat.photo}" style="width:45px;height:45px;border-radius:50%;"><div><h4 class="text-white">${chat.name}</h4><p class="text-sm text-muted">${chat.lastMessage.substring(0,30)}</p></div></div></div>`; }); document.getElementById('admin-chat-users').innerHTML = html; }); }
function openAdminChat(uid, name) { activeAdminChatUser = uid; document.getElementById('admin-chat-title').innerText = name; document.getElementById('adminChatModal').style.display = 'flex'; db.ref(`chats/${uid}/messages`).on('value', snap => { let html=''; snap.forEach(child => { let msg = child.val(); html+=`<div class="msg-bubble ${msg.sender==='admin' ? 'msg-self' : 'msg-other'}">${msg.text}</div>`; }); let box = document.getElementById('admin-chat-box'); box.innerHTML = html; setTimeout(() => box.scrollTop = box.scrollHeight, 100); }); }
function adminSendMessage() { let text=document.getElementById('admin-chat-input').value.trim(); if(!text||!activeAdminChatUser) return; db.ref(`chats/${activeAdminChatUser}/messages`).push({text,sender:'admin',timestamp:Date.now()}); db.ref(`chats/${activeAdminChatUser}`).update({lastMessage:"Admin: "+text,timestamp:Date.now()}); document.getElementById('admin-chat-input').value=''; }

// --- BROADCAST (UPDATED WITH IMAGE) ---
function sendNotification() {
    let title = document.getElementById('notif-title').value;
    let desc = document.getElementById('notif-desc').value;
    let image = document.getElementById('notif-img').value.trim(); // NEW IMAGE VALUE

    if(!title || !desc) return showToast("Both Title and Message are required!");

    db.ref('notifications').push({ title, desc, image, timestamp: Date.now() });
    showToast("Global Broadcast Sent Successfully!");
    
    document.getElementById('notif-title').value = '';
    document.getElementById('notif-desc').value = '';
    document.getElementById('notif-img').value = '';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg) { let t=document.getElementById('toast'); document.getElementById('toast-msg').innerText=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),3500); }