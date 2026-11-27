import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, getDoc, updateDoc, setDoc, query, orderBy, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDa10ia02K0vsHgzj-iTf4S6BwKzQruqyY",
            authDomain: "red-zulassungsdienst.firebaseapp.com",
            projectId: "red-zulassungsdienst",
            storageBucket: "red-zulassungsdienst.firebasestorage.app",
            messagingSenderId: "426545703080",
            appId: "1:426545703080:web:282cbe0bb5eb5fc09f7a9d"
        };

       const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);
        
        window.firebaseDb = db;
        window.firebaseAuth = auth;
        window.firebaseDoc = doc;
        window.firebaseGetDoc = getDoc;
        window.firebaseOnSnapshot = onSnapshot;
        window.firebaseCollection = collection;
        window.firebaseAddDoc = addDoc;
        window.firebaseUpdateDoc = updateDoc;
        window.firebaseDeleteDoc = deleteDoc;
        window.firebaseSetDoc = setDoc;

        window.bookedSlotsList = [];
        onSnapshot(collection(db, "booked_slots"), (snapshot) => {
            const slots = [];
            snapshot.forEach(d => slots.push({ id: d.id, ...d.data() }));
            window.bookedSlotsList = slots;
        });

        window.crmClientsDetail = {};
        
        // Globales Theme-Sync (Standard ist Hellmodus, sofern nicht vom Kunden manuell für die Sitzung umgeschaltet)
        onSnapshot(doc(db, "settings", "global_theme_v3"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const theme = data.activeTheme || 'light';
                if(data.customVars) {
                    localStorage.setItem('red_custom_theme', JSON.stringify(data.customVars));
                }
                if (!sessionStorage.getItem('red_customer_manual_theme')) {
                    window.changeTheme(theme, false);
                    if (document.getElementById('themeSelector')) {
                        document.getElementById('themeSelector').value = theme;
                    }
                }
            }
        });

        onSnapshot(doc(db, "settings", "calc_items"), (docSnap) => {
            if (docSnap.exists() && docSnap.data().list) {
                window.calcItemsData = docSnap.data().list;
                localStorage.setItem('red_calc_items_v2', JSON.stringify(window.calcItemsData));
                window.renderCalcItems(window.calcItemsData);
            }
        });

        let crmUnsubscribe = null;
        window.startAdminCrmListener = function() {
            if (!window.isAuthorized || crmUnsubscribe) return;
            crmUnsubscribe = onSnapshot(doc(db, "settings", "crm_details"), (docSnap) => {
                if (docSnap.exists()) {
                    window.crmClientsDetail = docSnap.data().details || {};
                    if (document.getElementById('kpiTotalCrm')) {
                        document.getElementById('kpiTotalCrm').innerText = Object.keys(window.crmClientsDetail).length;
                    }
                    if (document.getElementById('crmOverlay').classList.contains('open')) window.renderCRM();
                    if (document.getElementById('crmViewAllOverlay').classList.contains('open')) window.renderCRMViewAll();
                }
            });
        };

        let invoicesUnsubscribe = null;
        window.startAdminInvoicesListener = function() {
            if (!window.isAuthorized || invoicesUnsubscribe) return;
            invoicesUnsubscribe = onSnapshot(doc(db, "settings", "invoices_archive"), (docSnap) => {
                if (docSnap.exists() && Array.isArray(docSnap.data().list)) {
                    window.savedInvoicesData = docSnap.data().list;
                    localStorage.setItem('red_saved_invoices_v1', JSON.stringify(window.savedInvoicesData));
                    if (typeof window.updateInvoiceCountBadges === 'function') window.updateInvoiceCountBadges();
                    if (document.getElementById('cashInvoiceOverlay')?.classList.contains('open')) {
                        window.renderSavedInvoicesArchive();
                    }
                    if (document.getElementById('crmOverlay')?.classList.contains('open') && typeof window.renderCRM === 'function') {
                        window.renderCRM();
                    }
                }
            });
        };

        onSnapshot(collection(db, "custom_pages"), (snapshot) => {
            const pages = [];
            snapshot.forEach(docSnap => pages.push({ id: docSnap.id, ...docSnap.data() }));
            pages.sort((a, b) => (a.order ?? a.timestamp ?? 0) - (b.order ?? b.timestamp ?? 0));
            window.customPagesData = pages;
            localStorage.setItem('red_custom_pages', JSON.stringify(pages));
            if (typeof window.renderCustomPagesToDOM === 'function') window.renderCustomPagesToDOM();
            if (document.getElementById('pageManagerOverlay')?.classList.contains('open') && typeof window.renderPageManagerList === 'function') {
                window.renderPageManagerList();
            }
        }, () => {
            const localPages = JSON.parse(localStorage.getItem('red_custom_pages')) || [];
            window.customPagesData = localPages;
            if (typeof window.renderCustomPagesToDOM === 'function') window.renderCustomPagesToDOM();
        });

        window.saveCRMDetail = async function() {
            const clientId = document.getElementById('crmEditClientId').value;
            const detail = {
                clientId: clientId,
                category: document.getElementById('crmEditCategory') ? document.getElementById('crmEditCategory').value : 'Privatkunde',
                name: document.getElementById('crmEditName').value,
                phone: document.getElementById('crmEditPhone').value,
                email: document.getElementById('crmEditEmail').value,
                birthday: document.getElementById('crmEditBirthday').value,
                address: document.getElementById('crmEditAddress').value,
                city: document.getElementById('crmEditCity').value,
                notes: document.getElementById('crmEditNotes').value,
                bookings: window.crmClientsDetail[clientId] ? window.crmClientsDetail[clientId].bookings : 1,
                timestamp: window.crmClientsDetail[clientId] ? window.crmClientsDetail[clientId].timestamp : Date.now()
            };

            window.crmClientsDetail[clientId] = detail;
            try {
                await setDoc(doc(db, "settings", "crm_details"), { details: window.crmClientsDetail }, {merge: true});
                window.showToast('Kunden-Akte dauerhaft gespeichert!', 'success');
            } catch(e) {
                localStorage.setItem('red_crm_details', JSON.stringify(window.crmClientsDetail));
                window.showToast('Lokal gespeichert.', 'success');
            }
            window.closeCRMDetail();
            window.renderCRM();
            if(document.getElementById('crmViewAllOverlay').classList.contains('open')) window.renderCRMViewAll();
        };

        window.deleteCRMClient = function() {
            const clientId = document.getElementById('crmEditClientId').value;
            window.openRedDeleteConfirm(
                'Kunden-Akte löschen?',
                'Möchten Sie diese Kunden-Akte (mitsamt aller Notizen & Basisdaten) wirklich dauerhaft löschen?',
                async () => {
                    delete window.crmClientsDetail[clientId];
                    try {
                        await setDoc(doc(db, "settings", "crm_details"), { details: window.crmClientsDetail });
                        window.showToast('Kunden-Akte aus Datenbank gelöscht.', 'success');
                    } catch(e) {
                        localStorage.setItem('red_crm_details', JSON.stringify(window.crmClientsDetail));
                        window.showToast('Lokal gelöscht.', 'success');
                    }
                    window.closeCRMDetail();
                    window.renderCRM();
                    if(document.getElementById('crmViewAllOverlay').classList.contains('open')) window.renderCRMViewAll();
                }
            );
        };

        const CORE_ADMIN_EMAILS = ['admin@red-berlin.de', 'supervisor@red-berlin.de'];
        const USER_LOGIN_ALIASES = {
            'tamer yazici': 'admin@red-berlin.de',
            'admin': 'admin@red-berlin.de',
            'musadmin': 'supervisor@red-berlin.de',
            'supervisor': 'supervisor@red-berlin.de'
        };

        window.customAdminUsers = JSON.parse(localStorage.getItem('red_custom_admin_users_v1') || '{}');
        window.selectedPermTargetEmail = 'admin@red-berlin.de';
        window.isAuthorized = false;
        window.loggedInUser = null;
        window.loggedInEmail = '';

        function resolveUserPermsObject(raw) {
            return {
                leads: raw?.leads !== false,
                prices: raw?.prices !== false,
                customblocks: raw?.customblocks !== false,
                content: raw?.content !== false,
                companydata: raw?.companydata !== false,
                forms: raw?.forms !== false,
                cars: raw?.cars !== false,
                ticker: raw?.ticker !== false,
                crm: raw?.crm !== false,
                pages: raw?.pages !== false,
                theme: raw?.theme !== false,
                invoice: raw?.invoice === true,
                shopgallery: raw?.shopgallery === true,
                videos: raw?.videos === true
            };
        }

        function setPermCheckboxesFromObj(p) {
            const map = {
                permLeads: p.leads, permPrices: p.prices, permCustomblocks: p.customblocks,
                permContent: p.content, permCompanydata: p.companydata, permForms: p.forms,
                permCars: p.cars, permTicker: p.ticker, permCrm: p.crm,
                permPages: p.pages, permTheme: p.theme, permInvoice: p.invoice, permShopgallery: p.shopgallery, permVideos: p.videos
            };
            Object.entries(map).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.checked = val === true;
            });
            if (typeof window.updateSupervisorPermCounter === 'function') window.updateSupervisorPermCounter();
        }

        window.refreshSupervisorUserSelect = function() {
            const sel = document.getElementById('supTargetUserSelect');
            const cntBadge = document.getElementById('supUserCountBadge');
            const customList = Object.values(window.customAdminUsers || {});
            if (cntBadge) cntBadge.innerText = String(2 + customList.length);
            if (!sel) return;

            const prevVal = window.selectedPermTargetEmail || sel.value || 'admin@red-berlin.de';
            sel.innerHTML = `<option value="admin@red-berlin.de">Tamer Yazici (Standard Admin)</option>`;
            customList.forEach(u => {
                if (u.role === 'supervisor') return;
                const opt = document.createElement('option');
                opt.value = u.email;
                opt.textContent = `${u.name || u.email} (${u.email})${u.active === false ? ' [Gesperrt]' : ''}`;
                sel.appendChild(opt);
            });
            sel.value = Array.from(sel.options).some(o => o.value === prevVal) ? prevVal : 'admin@red-berlin.de';
            window.selectedPermTargetEmail = sel.value;
            if (typeof window.syncMobileSelectDisplay === 'function') window.syncMobileSelectDisplay(sel);
        };

        window.onSupervisorTargetUserChange = function(targetEmail) {
            window.selectedPermTargetEmail = (targetEmail || 'admin@red-berlin.de').toLowerCase();
            if (window.selectedPermTargetEmail === 'admin@red-berlin.de') {
                const saved = JSON.parse(localStorage.getItem('red_admin_perms') || 'null') || window.adminPermissions;
                setPermCheckboxesFromObj(resolveUserPermsObject(saved));
            } else {
                const u = (window.customAdminUsers || {})[window.selectedPermTargetEmail];
                setPermCheckboxesFromObj(resolveUserPermsObject(u?.perms || {}));
            }
        };

        window.renderSupervisorUsersList = function() {
            const box = document.getElementById('supUsersList');
            window.refreshSupervisorUserSelect();
            if (!box) return;

            const coreCards = `
                <div class="sup-user-card">
                    <div class="sup-user-meta">
                        <strong>Supervisor (Hauptkonto)</strong>
                        <span>supervisor@red-berlin.de</span>
                        <span class="sup-user-role-tag">👑 Vollzugriff · Geschützt</span>
                    </div>
                </div>
                <div class="sup-user-card">
                    <div class="sup-user-meta">
                        <strong>Tamer Yazici (Standard-Admin)</strong>
                        <span>admin@red-berlin.de</span>
                        <span class="sup-user-role-tag" style="background:var(--green-bg-soft); color:var(--green-accent);">Admin · Aktiv</span>
                    </div>
                    <div class="sup-user-actions">
                        <button type="button" class="inv-arch-btn edit" onclick="window.selectedPermTargetEmail='admin@red-berlin.de'; window.refreshSupervisorUserSelect(); window.onSupervisorTargetUserChange('admin@red-berlin.de'); window.switchSupervisorTab('perms');"><i class="fa-solid fa-sliders"></i> Rechte</button>
                    </div>
                </div>
            `;

            const customCards = Object.values(window.customAdminUsers || {}).map(u => {
                const isActive = u.active !== false;
                const isSup = u.role === 'supervisor';
                return `
                    <div class="sup-user-card ${isActive ? '' : 'is-disabled'}">
                        <div class="sup-user-meta">
                            <strong>${window.escHtml(u.name || 'Mitarbeiter')}${u.alias ? ` <small style="color:var(--text-muted); font-weight:700;">(${window.escHtml(u.alias)})</small>` : ''}</strong>
                            <span>${window.escHtml(u.email)}</span>
                            <span class="sup-user-role-tag" style="${isActive ? (isSup ? '' : 'background:var(--green-bg-soft); color:var(--green-accent);') : 'background:rgba(128,128,140,0.2); color:var(--text-muted);'}">${isSup ? '👑 Supervisor' : '👤 Admin / Mitarbeiter'} · ${isActive ? 'Aktiv' : 'Gesperrt'}</span>
                        </div>
                        <div class="sup-user-actions">
                            ${!isSup ? `<button type="button" class="inv-arch-btn edit" onclick="window.selectedPermTargetEmail='${window.escHtml(u.email)}'; window.refreshSupervisorUserSelect(); window.onSupervisorTargetUserChange('${window.escHtml(u.email)}'); window.switchSupervisorTab('perms');"><i class="fa-solid fa-sliders"></i> Rechte</button>` : ''}
                            <button type="button" class="inv-arch-btn" onclick="window.toggleCustomUserActive('${window.escHtml(u.email)}')" title="${isActive ? 'Konto sperren' : 'Konto aktivieren'}"><i class="fa-solid ${isActive ? 'fa-lock' : 'fa-lock-open'}" style="color:${isActive ? '#d97706' : 'var(--green-accent)'};"></i></button>
                            <button type="button" class="inv-arch-btn del" onclick="window.deleteCustomUserEntry('${window.escHtml(u.email)}')" title="Benutzer entfernen"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            box.innerHTML = coreCards + customCards;
        };

        window.createSupervisorUser = async function() {
            if (!document.body.classList.contains('is-supervisor')) {
                window.showToast('Nur der Supervisor darf neue Benutzer anlegen.', 'error');
                return;
            }
            const name = (document.getElementById('newUserFullName')?.value || '').trim();
            const alias = (document.getElementById('newUserAlias')?.value || '').trim().toLowerCase();
            const email = (document.getElementById('newUserEmail')?.value || '').trim().toLowerCase();
            const role = document.getElementById('newUserRole')?.value || 'admin';
            const password = document.getElementById('newUserPassword')?.value || '';
            const btn = document.getElementById('btnCreateNewUser');

            if (!name || !email || !email.includes('@')) {
                window.showToast('Bitte Name und eine gültige E-Mail-Adresse eingeben.', 'error');
                return;
            }
            if (password.length < 6) {
                window.showToast('Das Start-Passwort muss mindestens 6 Zeichen lang sein.', 'error');
                return;
            }

            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Konto wird erstellt...'; }
            let authCreatedNote = '';
            try {
                // Sekundäre App-Instanz verhindert, dass der Supervisor abgemeldet wird
                const secAppName = 'RedUserCreator_' + Date.now();
                const secApp = initializeApp(firebaseConfig, secAppName);
                const secAuth = getAuth(secApp);
                try {
                    await createUserWithEmailAndPassword(secAuth, email, password);
                    await signOut(secAuth);
                } catch (authErr) {
                    if (authErr.code === 'auth/email-already-in-use') {
                        authCreatedNote = ' (Bestehendes Firebase-Konto verknüpft)';
                    } else {
                        throw authErr;
                    }
                }

                const newEntry = {
                    name, alias, email, role, active: true,
                    perms: resolveUserPermsObject({ leads: true, crm: true, prices: true, forms: true, invoice: false, shopgallery: false, pages: false, theme: false, companydata: false, customblocks: false, content: false, cars: false, ticker: false }),
                    createdAt: Date.now()
                };
                window.customAdminUsers[email] = newEntry;
                localStorage.setItem('red_custom_admin_users_v1', JSON.stringify(window.customAdminUsers));
                await setDoc(doc(db, "settings", "admin_users"), { users: window.customAdminUsers, updatedAt: Date.now() }, { merge: true });

                document.getElementById('newUserFullName').value = '';
                document.getElementById('newUserAlias').value = '';
                document.getElementById('newUserEmail').value = '';
                document.getElementById('newUserPassword').value = '';

                window.renderSupervisorUsersList();
                window.showToast(`Benutzer ${name} erfolgreich angelegt!${authCreatedNote}`, 'success');
            } catch (err) {
                console.error('Benutzer anlegen Fehler:', err);
                window.showToast('Fehler beim Anlegen: ' + (err.message || err.code), 'error');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-check"></i> Benutzer jetzt anlegen & freischalten'; }
            }
        };

        window.toggleCustomUserActive = async function(email) {
            const u = window.customAdminUsers[email];
            if (!u) return;
            u.active = u.active === false ? true : false;
            localStorage.setItem('red_custom_admin_users_v1', JSON.stringify(window.customAdminUsers));
            await setDoc(doc(db, "settings", "admin_users"), { users: window.customAdminUsers, updatedAt: Date.now() }, { merge: true }).catch(() => {});
            window.renderSupervisorUsersList();
            window.showToast(u.active ? `Konto ${u.name} aktiviert.` : `Konto ${u.name} gesperrt.`, 'success');
        };

        window.deleteCustomUserEntry = function(email) {
            const u = window.customAdminUsers[email];
            if (!u) return;
            window.openRedDeleteConfirm(
                `Benutzer „${u.name}“ entfernen?`,
                `Soll der Zugriff für ${email} dauerhaft aus dem RED-System entfernt werden?`,
                async () => {
                    delete window.customAdminUsers[email];
                    localStorage.setItem('red_custom_admin_users_v1', JSON.stringify(window.customAdminUsers));
                    await setDoc(doc(db, "settings", "admin_users"), { users: window.customAdminUsers, updatedAt: Date.now() }).catch(() => {});
                    window.selectedPermTargetEmail = 'admin@red-berlin.de';
                    window.renderSupervisorUsersList();
                    window.showToast(`Benutzer ${u.name} entfernt.`, 'success');
                }
            );
        };

        let adminUsersUnsub = null;
        window.startAdminUsersListener = function() {
            if (!window.isAuthorized || adminUsersUnsub) return;
            adminUsersUnsub = onSnapshot(doc(db, "settings", "admin_users"), (docSnap) => {
                if (docSnap.exists() && docSnap.data().users) {
                    window.customAdminUsers = docSnap.data().users;
                    localStorage.setItem('red_custom_admin_users_v1', JSON.stringify(window.customAdminUsers));
                    window.renderSupervisorUsersList();
                    const me = window.customAdminUsers[window.loggedInEmail];
                    if (me && !document.body.classList.contains('is-supervisor')) {
                        if (me.active === false) {
                            signOut(auth).catch(() => {});
                            window.showToast('Ihr Zugang wurde vom Supervisor gesperrt.', 'error');
                        } else if (me.perms) {
                            window.applyAdminModulePermissions(me.perms);
                        }
                    }
                }
            }, () => {});
        };

        onAuthStateChanged(auth, async (user) => {
            const email = (user?.email || '').toLowerCase();
            if (user && email) {
                let customUsers = window.customAdminUsers || {};
                try {
                    const uSnap = await getDoc(doc(db, "settings", "admin_users"));
                    if (uSnap.exists() && uSnap.data().users) {
                        customUsers = uSnap.data().users;
                        window.customAdminUsers = customUsers;
                        localStorage.setItem('red_custom_admin_users_v1', JSON.stringify(customUsers));
                    }
                } catch (e) {}

                const customProfile = customUsers[email];
                const isCore = CORE_ADMIN_EMAILS.includes(email);
                if (!isCore && (!customProfile || customProfile.active === false)) {
                    await signOut(auth).catch(() => {});
                    window.showToast('Konto nicht freigeschaltet oder gesperrt.', 'error');
                    return;
                }

                const isSupervisor = (email === 'supervisor@red-berlin.de') || (customProfile?.role === 'supervisor');
                window.isAuthorized = true;
                window.loggedInEmail = email;
                window.loggedInUser = isSupervisor ? (customProfile?.name || 'Supervisor') : (customProfile?.name || 'Tamer Yazici');

                document.body.classList.add('is-admin');
                document.body.classList.toggle('is-supervisor', isSupervisor);

                document.getElementById('authBox').style.display = 'none';
                document.getElementById('dashboardBox').style.display = 'block';
                if (document.getElementById('loggedInUser')) {
                    document.getElementById('loggedInUser').innerText = `${window.loggedInUser} (${email})`;
                }

                if (customProfile && !isSupervisor && customProfile.perms) {
                    window.applyAdminModulePermissions(customProfile.perms);
                } else {
                    const localPerms = JSON.parse(localStorage.getItem('red_admin_perms') || 'null');
                    window.applyAdminModulePermissions(localPerms || window.adminPermissions);
                }

                window.startAdminCrmListener();
                window.startAdminInvoicesListener();
                window.startAdminUsersListener();
                if (typeof window.renderShopGallery === 'function') window.renderShopGallery();
                if (typeof window.startAdminAppointmentsListener === 'function') {
                    window.startAdminAppointmentsListener();
                }
                window.renderSupervisorUsersList();
                setTimeout(window.syncHeaderHeight, 80);
            } else {
                window.isAuthorized = false;
                window.loggedInUser = null;
                window.loggedInEmail = '';
                document.body.classList.remove('is-admin', 'is-supervisor', 'perm-leads', 'perm-prices', 'perm-blocks', 'perm-content', 'perm-data', 'perm-forms', 'perm-cars', 'perm-ticker', 'perm-crm', 'perm-pages', 'perm-theme', 'perm-invoice', 'perm-shopgallery', 'perm-videos');

                if (crmUnsubscribe) { crmUnsubscribe(); crmUnsubscribe = null; }
                if (invoicesUnsubscribe) { invoicesUnsubscribe(); invoicesUnsubscribe = null; }
                if (adminUsersUnsub) { adminUsersUnsub(); adminUsersUnsub = null; }
                if (typeof window.stopAdminAppointmentsListener === 'function') {
                    window.stopAdminAppointmentsListener();
                }
                window.crmClientsDetail = {};
                window.savedInvoicesData = [];
                window.redApts = [];
                localStorage.removeItem('red_crm_details');
                localStorage.removeItem('red_saved_invoices_v1');
                localStorage.removeItem('red_local_apts');
                localStorage.removeItem('red_admin_saved');
                localStorage.removeItem('red_logged_in_user');

                if (document.getElementById('dashboardBox')) document.getElementById('dashboardBox').style.display = 'none';
                if (document.getElementById('authBox')) document.getElementById('authBox').style.display = 'block';
                setTimeout(window.syncHeaderHeight, 80);
            }
        });

        window.tryLogin = async function() {
            const rawUser = document.getElementById('adminUser').value.trim();
            const pass = document.getElementById('adminPass').value;
            const remember = document.getElementById('rememberMe').checked;

            if (!rawUser || !pass) {
                window.showToast('Bitte E-Mail und Passwort eingeben.', 'error');
                return;
            }

            const lowerRaw = rawUser.toLowerCase();
            let email = USER_LOGIN_ALIASES[lowerRaw] || lowerRaw;
            if (!email.includes('@')) {
                const aliasHit = Object.values(window.customAdminUsers || {}).find(u => u.alias && u.alias.toLowerCase() === lowerRaw);
                if (aliasHit) email = aliasHit.email;
            }
            if (!email.includes('@')) {
                window.showToast('Bitte vollständige E-Mail-Adresse eingeben.', 'error');
                return;
            }

            try {
                await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
                await signInWithEmailAndPassword(auth, email, pass);
                document.getElementById('adminPass').value = '';
                window.showToast('Sicher über Firebase angemeldet!', 'success');
            } catch (err) {
                console.error('Firebase Login Fehler:', err.code, err.message);
                if (err.code === 'auth/too-many-requests') {
                    window.showToast('Zu viele Versuche – bitte kurz warten.', 'error');
                } else {
                    window.showToast('E-Mail oder Passwort ist falsch!', 'error');
                }
            }
        };

        window.triggerLogoutConfirm = function() { document.getElementById('logoutConfirmOverlay').classList.add('open'); };
        window.cancelLogout = function() { document.getElementById('logoutConfirmOverlay').classList.remove('open'); };
        window.executeLogout = async function() {
            try { await signOut(auth); } catch (e) {}
            document.getElementById('adminUser').value = '';
            document.getElementById('adminPass').value = '';
            window.cancelLogout();
            window.showToast('Erfolgreich abgemeldet.', 'success');
        };

        window.changePassPrompt = function() {
            if (!window.isAuthorized) return;
            const lbl = document.getElementById('pwActiveAccountLabel');
            if (lbl) lbl.innerText = `${window.loggedInUser || 'Admin'} (${window.loggedInEmail || auth.currentUser?.email || ''})`;
            document.getElementById('newPassInput').value = '';
            if (document.getElementById('newPassConfirmInput')) document.getElementById('newPassConfirmInput').value = '';
            if (typeof window.updatePasswordStrength === 'function') window.updatePasswordStrength();
            document.getElementById('passChangeOverlay').classList.add('open');
        };
        window.closePassPrompt = function() {
            document.getElementById('passChangeOverlay').classList.remove('open');
            document.getElementById('newPassInput').value = '';
            if (document.getElementById('newPassConfirmInput')) document.getElementById('newPassConfirmInput').value = '';
        };
        window.confirmPassChange = async function() {
            const newP = document.getElementById('newPassInput').value.trim();
            const confirmP = document.getElementById('newPassConfirmInput')?.value.trim() ?? newP;
            if (!auth.currentUser) return;
            if (newP.length < 6) {
                window.showToast('Passwort muss mindestens 6 Zeichen lang sein!', 'error');
                return;
            }
            if (newP !== confirmP) {
                window.showToast('Die beiden Passwörter stimmen nicht überein!', 'error');
                return;
            }
            try {
                await updatePassword(auth.currentUser, newP);
                window.closePassPrompt();
                window.showToast('Passwort sicher in Firebase aktualisiert!', 'success');
            } catch (err) {
                if (err.code === 'auth/requires-recent-login') {
                    window.showToast('Bitte kurz abmelden und neu einloggen, um das Passwort zu ändern.', 'error');
                } else {
                    window.showToast('Fehler beim Ändern: ' + err.message, 'error');
                }
            }
        };

        window.saveSupervisorPerms = async function() {
            const targetEmail = (window.selectedPermTargetEmail || 'admin@red-berlin.de').toLowerCase();
            const perms = {
                leads: document.getElementById('permLeads').checked,
                prices: document.getElementById('permPrices').checked,
                customblocks: document.getElementById('permCustomblocks').checked,
                content: document.getElementById('permContent').checked,
                companydata: document.getElementById('permCompanydata').checked,
                forms: document.getElementById('permForms').checked,
                cars: document.getElementById('permCars').checked,
                ticker: document.getElementById('permTicker').checked,
                crm: document.getElementById('permCrm').checked,
                pages: document.getElementById('permPages').checked,
                theme: document.getElementById('permTheme').checked,
                invoice: document.getElementById('permInvoice')?.checked === true,
                shopgallery: document.getElementById('permShopgallery')?.checked === true,
                videos: document.getElementById('permVideos')?.checked === true,
                timestamp: Date.now()
            };

            try {
                if (targetEmail === 'admin@red-berlin.de') {
                    await setDoc(doc(db, "settings", "admin_permissions"), perms);
                    localStorage.setItem('red_admin_perms', JSON.stringify(perms));
                    window.showToast('Rechte für Standard-Admin aktualisiert!', 'success');
                } else if (window.customAdminUsers[targetEmail]) {
                    window.customAdminUsers[targetEmail].perms = perms;
                    localStorage.setItem('red_custom_admin_users_v1', JSON.stringify(window.customAdminUsers));
                    await setDoc(doc(db, "settings", "admin_users"), { users: window.customAdminUsers, updatedAt: Date.now() }, { merge: true });
                    window.showToast(`Rechte für ${window.customAdminUsers[targetEmail].name} aktualisiert!`, 'success');
                }
            } catch (e) {
                window.showToast('Lokal gespeichert.', 'success');
            }
            window.closeSupervisorPanel();
        };

        if(db) {
            onSnapshot(doc(db, "settings", "admin_permissions"), (docSnap) => {
                if(docSnap.exists()) {
                    const data = docSnap.data();
                    localStorage.setItem('red_admin_perms', JSON.stringify(data));
                    window.applyAdminModulePermissions(data);
                } else {
                    const localPerms = JSON.parse(localStorage.getItem('red_admin_perms'));
                    if(localPerms) window.applyAdminModulePermissions(localPerms);
                }
            });
            
            const visitorDocRef = doc(db, "settings", "visitors");
            if (!sessionStorage.getItem('red_visited_counted')) {
                updateDoc(visitorDocRef, { count: increment(1) })
                .then(() => {
                    sessionStorage.setItem('red_visited_counted', 'true');
                })
                .catch(() => {
                    sessionStorage.setItem('red_visited_counted', 'true');
                });
            }
            
            onSnapshot(visitorDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const count = Number(docSnap.data().count) || 0;
                    document.querySelectorAll('#vCount').forEach(el => el.innerText = count.toLocaleString('de-DE'));
                } else {
                    document.querySelectorAll('#vCount').forEach(el => el.innerText = '0');
                }
            });
            
            onSnapshot(doc(db, "settings", "contact"), (docSnap) => {
                if(docSnap.exists()) {
                    const data = docSnap.data();
                    window.applyContactInfo(data);
                    document.getElementById('adminPhone').value = data.phone || '';
                    document.getElementById('adminEmail').value = data.email || '';
                    document.getElementById('adminUstid').value = data.ustid || '';
                    document.getElementById('adminIg').value = data.ig || '';
                    document.getElementById('adminFb').value = data.fb || '';
                    if (document.getElementById('adminGoogleReview')) document.getElementById('adminGoogleReview').value = data.googleReview || '';
                    document.getElementById('adminWebhook').value = data.webhook || '';
                }
            });

            onSnapshot(doc(db, "settings", "services"), (docSnap) => {
                if(docSnap.exists() && docSnap.data().list) {
                    const data = docSnap.data().list;
                    window.servicesData = data;
                    localStorage.setItem('red_services_v2', JSON.stringify(data));
                    window.renderServices(data);
                }
            });

            onSnapshot(doc(db, "settings", "page_content"), (docSnap) => {
                if(docSnap.exists()) {
                    const data = docSnap.data();
                    localStorage.setItem('red_page_content', JSON.stringify(data));
                    window.applyPageContent(data);
                }
            });

            onSnapshot(doc(db, "settings", "shop_gallery"), (docSnap) => {
                if(docSnap.exists() && Array.isArray(docSnap.data().list)) {
                    window.shopPhotosData = docSnap.data().list;
                    localStorage.setItem('red_shop_gallery_v1', JSON.stringify(window.shopPhotosData));
                    if (typeof window.renderShopGallery === 'function') window.renderShopGallery();
                }
            });

            onSnapshot(doc(db, "settings", "promo_videos"), (docSnap) => {
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    window.promoVideosConfig = {
                        placement: d.placement || 'after-hero',
                        autoplayMode: d.autoplayMode || 'muted-auto',
                        layoutMode: d.layoutMode || 'showcase',
                        multiMode: d.multiMode || 'grid',
                        sectionEyebrow: d.sectionEyebrow || 'RED Berlin in Aktion',
                        list: Array.isArray(d.list) ? d.list : []
                    };
                    if (typeof window.normalizePromoVideosConfig === 'function') {
                        window.normalizePromoVideosConfig(window.promoVideosConfig);
                    }
                    localStorage.setItem('red_promo_videos_v1', JSON.stringify(window.promoVideosConfig));
                    if (typeof window.renderPromoVideoShowcase === 'function') window.renderPromoVideoShowcase();
                    if (document.getElementById('videoManagerOverlay')?.classList.contains('open') && typeof window.renderVideoManagerList === 'function') {
                        window.renderVideoManagerList();
                    }
                }
            });

            onSnapshot(doc(db, "settings", "brand_assets"), (docSnap) => {
                if (docSnap.exists()) {
                    window.brandAssetsData = { ...window.brandAssetsData, ...docSnap.data() };
                    localStorage.setItem('red_brand_assets_v1', JSON.stringify(window.brandAssetsData));
                    if (typeof window.applyBrandAssetsUI === 'function') window.applyBrandAssetsUI();
                }
            });
        }

        window.saveContactInfo = async function() {
            const phone = document.getElementById('adminPhone').value;
            const email = document.getElementById('adminEmail').value;
            const ustid = document.getElementById('adminUstid').value;
            const ig = document.getElementById('adminIg').value;
            const fb = document.getElementById('adminFb').value;
            const googleReview = (document.getElementById('adminGoogleReview')?.value || '').trim();
            const webhook = document.getElementById('adminWebhook').value;
            
            const data = { phone, email, ustid, ig, fb, googleReview, webhook, timestamp: Date.now() };

            try {
                await setDoc(doc(db, "settings", "contact"), data);
                window.showToast('Firmendaten & Einstellungen gespeichert!', 'success');
            } catch(e) {
                localStorage.setItem('red_contact', JSON.stringify(data));
                window.applyContactInfo(data);
                window.showToast('Lokal gespeichert.', 'success');
            }
        };
        
        window.openContentEditor = function(section) {
            if(!window.isAuthorized) return;
            document.getElementById('editSectionId').value = section;
            const fieldsDiv = document.getElementById('contentEditorFields');
            fieldsDiv.innerHTML = '';

            const labelMap = {
                badge: 'Aktions-Badge (oben)', h1_1: 'Hauptüberschrift Zeile 1', h1_2: 'Hauptüberschrift Zeile 2 (Rot)',
                title: 'Bereichs-Überschrift', subtitle: 'Untertitel', desc: 'Beschreibungstext', sign: 'Signatur / Kürzel',
                wk_title: 'Wunschkennzeichen-Studio – Überschrift', wk_desc: 'Wunschkennzeichen-Studio – Beschreibung',
                calc_title: 'Schnell-Kalkulator – Überschrift', calc_desc: 'Schnell-Kalkulator – Beschreibung',
                item_1: 'Checkliste Punkt 1', item_2: 'Checkliste Punkt 2', item_3: 'Checkliste Punkt 3', item_4: 'Checkliste Punkt 4', item_5: 'Checkliste Punkt 5',
                q1: 'Frage 1', a1: 'Antwort 1', q2: 'Frage 2', a2: 'Antwort 2', q3: 'Frage 3', a3: 'Antwort 3',
                q4: 'Frage 4', a4: 'Antwort 4', q5: 'Frage 5', a5: 'Antwort 5', q6: 'Frage 6', a6: 'Antwort 6',
                datenschutz_extra: 'Datenschutz – Zusatzhinweis (Buchung)', text: 'Footer-Text (Copyright)'
            };

            const contentObj = window.pageContentData[section] || {};
            
            for (const key in contentObj) {
                const niceLabel = labelMap[key] || key.replace(/_/g, ' ').toUpperCase();
                const val = String(contentObj[key] || '');
                const rows = val.length > 90 ? 3 : 2;
                fieldsDiv.innerHTML += `
                    <div class="form-group" style="margin-bottom:12px;">
                        <label style="color:var(--text-light); font-weight:800; font-size:11px;">${window.escHtml(niceLabel)}</label>
                        <textarea id="ce_${key}" class="form-control" rows="${rows}" style="resize:vertical;">${window.escHtml(val)}</textarea>
                    </div>
                `;
            }
            
            document.getElementById('contentConfigOverlay').classList.add('open');
        };

        window.closeContentEditor = function() {
            document.getElementById('contentConfigOverlay').classList.remove('open');
        };

        window.saveContent = async function() {
            const section = document.getElementById('editSectionId').value;
            const contentObj = window.pageContentData[section];
            
            for (const key in contentObj) {
                const el = document.getElementById(`ce_${key}`);
                if(el) window.pageContentData[section][key] = el.value;
            }
            
            try {
                await setDoc(doc(db, "settings", "page_content"), window.pageContentData);
                window.showToast('Seiten-Text online gespeichert!', 'success');
            } catch(e) {
                localStorage.setItem('red_page_content', JSON.stringify(window.pageContentData));
                window.applyPageContent(window.pageContentData);
                window.showToast('Text lokal gespeichert.', 'success');
            }
            window.closeContentEditor();
        };

        function resolveHexColor(val, fallback) {
            let c = String(val || '').trim();
            if (c.startsWith('var(')) {
                const varName = c.slice(4, -1).split(',')[0].trim();
                c = getComputedStyle(document.body).getPropertyValue(varName).trim();
            }
            if (/^#[0-9a-f]{6}$/i.test(c)) return c;
            if (/^#[0-9a-f]{3}$/i.test(c)) {
                return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
            }
            const rgbaMatch = c.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/i);
            if (rgbaMatch && parseFloat(rgbaMatch[4]) < 0.45) {
                return (document.body.getAttribute('data-theme') || 'light').startsWith('light') ? '#d0d0d8' : '#2c2c38';
            }
            const rgbMatch = c.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
            if (rgbMatch) {
                const toHex = (n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, '0');
                return '#' + toHex(rgbMatch[1]) + toHex(rgbMatch[2]) + toHex(rgbMatch[3]);
            }
            return fallback;
        }

        window.openServiceConfig = function(id) {
            window.editingServiceId = id;
            const srv = window.servicesData.find(s => s.id === id);
            if(!srv) return;
            const isLight = (document.body.getAttribute('data-theme') || 'light').startsWith('light');
            
            document.getElementById('scTitle').value = srv.title;
            document.getElementById('scIcon').value = srv.icon;
            document.getElementById('scIconColor').value = resolveHexColor(srv.iconColor, '#d90000');
            
            document.getElementById('scTitleColor').value = resolveHexColor(srv.titleColor, isLight ? '#141417' : '#ffffff');
            document.getElementById('scTitleFont').value = srv.titleFont || "'Montserrat', sans-serif";
            document.getElementById('scTitleSize').value = srv.titleSize || "18px";
            
            document.getElementById('scBorderSize').value = srv.borderSize || '1px';
            document.getElementById('scBorderColor').value = resolveHexColor(srv.borderColor, isLight ? '#d0d0d8' : '#2c2c38');

            document.getElementById('scPriceVal').value = srv.price || '-';
            document.getElementById('scPriceColor').value = resolveHexColor(srv.priceColor, '#d90000');
            document.getElementById('scEuroStyle').value = srv.euroStyle || 'euro-standard';
            document.getElementById('scBadge').value = srv.badge || '';
            
            document.getElementById('scDesc').value = srv.desc;
            document.getElementById('scDescAnim').value = srv.descAnim || '';
            document.getElementById('scHoverInfo').value = srv.hoverInfo;

            document.getElementById('serviceConfigOverlay').classList.add('open');
        };

        window.closeServiceConfigModal = function() {
            window.editingServiceId = null;
            document.getElementById('serviceConfigOverlay').classList.remove('open');
        };

        window.saveServiceEdit = async function() {
            if(!window.editingServiceId) return;
            
            const index = window.servicesData.findIndex(s => s.id === window.editingServiceId);
            if(index > -1) {
                window.servicesData[index] = {
                    id: window.editingServiceId,
                    title: document.getElementById('scTitle').value,
                    icon: document.getElementById('scIcon').value.replace('fa-solid ', '').trim(),
                    iconColor: document.getElementById('scIconColor').value,
                    titleColor: document.getElementById('scTitleColor').value,
                    titleFont: document.getElementById('scTitleFont').value,
                    titleSize: document.getElementById('scTitleSize').value,
                    borderSize: document.getElementById('scBorderSize').value,
                    borderColor: document.getElementById('scBorderColor').value,
                    price: document.getElementById('scPriceVal').value.trim() || '-',
                    priceColor: document.getElementById('scPriceColor').value,
                    euroStyle: document.getElementById('scEuroStyle').value,
                    badge: document.getElementById('scBadge').value,
                    desc: document.getElementById('scDesc').value,
                    descAnim: document.getElementById('scDescAnim').value,
                    hoverInfo: document.getElementById('scHoverInfo').value
                };
                
                try {
                    await setDoc(doc(db, "settings", "services"), { list: window.servicesData });
                    window.showToast('Karte online gespeichert!', 'success');
                } catch(e) {
                    localStorage.setItem('red_services_v2', JSON.stringify(window.servicesData));
                    window.renderServices(window.servicesData);
                    window.showToast('Karte lokal gespeichert.', 'success');
                }
                window.closeServiceConfigModal();
            }
        };

        window.addNewServiceCard = async function() {
            const newCard = {
                id: 's-' + Date.now(),
                icon: "fa-star", iconColor: "#e60000", title: "Neue Leistung", titleColor: "#ffffff", titleFont: "'Montserrat', sans-serif", titleSize: "18px",
                borderSize: "1px", borderColor: "rgba(255, 255, 255, 0.08)",
                price: "-", priceColor: "#e60000", euroStyle: "euro-standard", badge: "badge-neu",
                desc: "Beschreibung anpassen...", descAnim: "", hoverInfo: "Mitzubringende Unterlagen eintragen."
            };
            window.servicesData.push(newCard);
            try {
                await setDoc(doc(db, "settings", "services"), { list: window.servicesData });
                window.showToast('Neue Karte erstellt!', 'success');
            } catch(e) {
                localStorage.setItem('red_services_v2', JSON.stringify(window.servicesData));
                window.renderServices(window.servicesData);
                window.showToast('Lokal erstellt.', 'success');
            }
        };

        window.deleteServiceCard = function(id) {
            window.openRedDeleteConfirm(
                'Leistungskarte löschen?',
                'Möchten Sie diese Leistungskarte wirklich dauerhaft von der Startseite entfernen?',
                async () => {
                    window.servicesData = window.servicesData.filter(s => s.id !== id);
                    try {
                        await setDoc(doc(db, "settings", "services"), { list: window.servicesData });
                        window.showToast('Karte gelöscht!', 'success');
                    } catch(e) {
                        localStorage.setItem('red_services_v2', JSON.stringify(window.servicesData));
                        window.renderServices(window.servicesData);
                        window.showToast('Lokal gelöscht.', 'success');
                    }
                }
            );
        };
        
        window.customBlocksData = [];

        onSnapshot(collection(db, "customblocks"), (snapshot) => {
            if(!snapshot.empty) {
                const blocksData = [];
                snapshot.forEach(docSnap => blocksData.push({ id: docSnap.id, ...docSnap.data() }));
                window.customBlocksData = blocksData;
                window.renderCustomBlocks(blocksData);
            } else {
                const localBlocks = JSON.parse(localStorage.getItem('red_customblocks')) || [];
                window.customBlocksData = localBlocks;
                window.renderCustomBlocks(localBlocks);
            }
        });

        window.saveCustomBlock = async function(event) {
            const btn = event.target;
            
            const title = document.getElementById('cbTitle').value;
            const icon = document.getElementById('cbIcon').value;
            const page = document.getElementById('cbPage').value;
            const text = document.getElementById('cbText').value;
            
            const titleFont = document.getElementById('cbTitleFont').value;
            const titleSize = document.getElementById('cbTitleSize').value;
            const titleColor = document.getElementById('cbTitleColor').value;
            
            const textFont = document.getElementById('cbTextFont').value;
            const textSize = document.getElementById('cbTextSize').value;
            const textColor = document.getElementById('cbTextColor').value;
            
            const borderSize = document.getElementById('cbBorderSize').value;
            const borderColor = document.getElementById('cbBorderColor').value;
            
            const bannerText = document.getElementById('cbBannerText').value;
            const bannerEmoji = document.getElementById('cbBannerEmoji').value;
            const bannerColor = document.getElementById('cbBannerColor').value;
            
            if(!title || !text) { window.showToast('Titel und Text erforderlich.', 'error'); return; }

            const fileInput = document.getElementById('cbMediaFile');
            
            const saveToFirestore = async (mediaUrl) => {
                const data = { 
                    title, icon, page, text, 
                    titleFont, titleSize, titleColor,
                    textFont, textSize, textColor,
                    borderSize, borderColor, bannerText, bannerEmoji, bannerColor,
                    mediaUrl, timestamp: window.editingBlockId ? window.customBlocksData.find(b => b.id === window.editingBlockId).timestamp : Date.now() 
                };

                try {
                    if(window.editingBlockId) {
                        await updateDoc(doc(db, "customblocks", window.editingBlockId), data);
                        window.showToast('Baustein aktualisiert!', 'success');
                    } else {
                        await addDoc(collection(db, "customblocks"), data);
                        window.showToast('Baustein veröffentlicht!', 'success');
                    }
                } catch(e) {
                    let localBlocks = JSON.parse(localStorage.getItem('red_customblocks')) || [];
                    if(window.editingBlockId) {
                        const index = localBlocks.findIndex(b => b.id === window.editingBlockId);
                        if(index > -1) {
                            localBlocks[index] = {id: window.editingBlockId, ...data};
                        }
                    } else {
                        localBlocks.push({id: 'cb-'+Date.now(), ...data, timestamp: Date.now()});
                    }
                    localStorage.setItem('red_customblocks', JSON.stringify(localBlocks));
                    window.renderCustomBlocks(localBlocks);
                    window.showToast('Lokal gespeichert.', 'success');
                }
                
                window.cancelEditBlock();
            };

            btn.innerText = 'Speichere...';
            btn.disabled = true;

            if(fileInput.files && fileInput.files[0]) {
                if (fileInput.files[0].size > 700 * 1024) {
                    window.showToast('Datei ist größer als 700 KB. Bitte vorher komprimieren.', 'error');
                    btn.innerText = window.editingBlockId ? 'Baustein Aktualisieren' : 'Baustein Erstellen & Veröffentlichen';
                    btn.disabled = false;
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(e) { saveToFirestore(e.target.result); };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                let existingMedia = '';
                if(window.editingBlockId) {
                    const existingBlock = window.customBlocksData.find(b => b.id === window.editingBlockId);
                    if(existingBlock) existingMedia = existingBlock.mediaUrl || '';
                }
                saveToFirestore(existingMedia);
            }
        };

        window.openEditBlock = function(id) {
            const block = window.customBlocksData.find(b => b.id === id);
            if(!block) return;
            
            window.editingBlockId = id;
            
            document.getElementById('cbTitle').value = block.title || '';
            document.getElementById('cbIcon').value = block.icon || '';
            document.getElementById('cbPage').value = block.page || 'home';
            document.getElementById('cbText').value = block.text || '';
            
            document.getElementById('cbTitleFont').value = block.titleFont || "'Montserrat', sans-serif";
            document.getElementById('cbTitleSize').value = block.titleSize || "clamp(20px, 3vw, 28px)";
            document.getElementById('cbTitleColor').value = block.titleColor || 'var(--primary-red)';
            
            document.getElementById('cbTextFont').value = block.textFont || "'Montserrat', sans-serif";
            document.getElementById('cbTextSize').value = block.textSize || "14px";
            document.getElementById('cbTextColor').value = block.textColor || 'var(--text-light)';
            
            document.getElementById('cbBorderSize').value = block.borderSize || '1px';
            document.getElementById('cbBorderColor').value = block.borderColor || 'var(--primary-red)';
            
            document.getElementById('cbBannerText').value = block.bannerText || '';
            document.getElementById('cbBannerEmoji').value = block.bannerEmoji || '';
            document.getElementById('cbBannerColor').value = block.bannerColor || 'var(--primary-red)';
            
            document.getElementById('btnSaveCustomBlock').innerText = 'Baustein Aktualisieren';
            document.getElementById('btnCancelEditBlock').style.display = 'flex';
            
            const details = document.querySelector('.mod-blocks details');
            if(details && !details.open) details.open = true;
            details.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.cancelEditBlock = function() {
            window.editingBlockId = null;
            
            document.getElementById('cbTitle').value = '';
            document.getElementById('cbIcon').value = '';
            document.getElementById('cbPage').value = 'home';
            document.getElementById('cbText').value = '';
            document.getElementById('cbBannerText').value = '';
            document.getElementById('cbBannerEmoji').value = '';
            
            document.getElementById('cbMediaFile').value = '';
            document.getElementById('cbFileLabelText').innerHTML = `<i class="fa-solid fa-upload"></i> Durchsuchen`;
            
            const btn = document.getElementById('btnSaveCustomBlock');
            btn.innerText = 'Baustein Erstellen & Veröffentlichen';
            btn.disabled = false;
            document.getElementById('btnCancelEditBlock').style.display = 'none';
        };

        window.deleteCustomBlock = function(id) {
            window.openRedDeleteConfirm(
                'Infoblock löschen?',
                'Möchten Sie diesen Baustein wirklich dauerhaft entfernen?',
                async () => {
                    try {
                        await deleteDoc(doc(db, "customblocks", id));
                        window.showToast('Gelöscht!', 'success');
                    } catch(err) {
                        let localBlocks = JSON.parse(localStorage.getItem('red_customblocks')) || [];
                        localBlocks = localBlocks.filter(b => b.id !== id);
                        localStorage.setItem('red_customblocks', JSON.stringify(localBlocks));
                        window.renderCustomBlocks(localBlocks);
                        window.showToast('Lokal gelöscht.', 'success');
                    }
                }
            );
        };

        // --- HEADER-AUTO, LOGO & TICKER STUDIO ---
        window.updateTickerStudioPreview = function() {
            const box = document.getElementById('tickerStudioLivePreview');
            if (!box) return;
            const fullText = document.getElementById('tickerFullText')?.value || '';
            const blinkWord = (document.getElementById('tickerBlinkWord')?.value || '').trim();
            const blinkColor = document.getElementById('tickerBlinkColor')?.value || '#e60000';
            const textColor = document.getElementById('tickerColor')?.value || '#ffffff';
            const font = document.getElementById('tickerFont')?.value || "'Montserrat', sans-serif";
            const size = document.getElementById('tickerSize')?.value || '13px';

            const safeText = window.escHtml(fullText);
            const safeBlink = window.escHtml(blinkWord);
            if (safeBlink && safeText.includes(safeBlink)) {
                const parts = safeText.split(safeBlink);
                box.innerHTML = `${parts[0]}<span class="ticker-highlight" style="color:${blinkColor};">${safeBlink}</span>${parts.slice(1).join(safeBlink)}`;
            } else {
                box.innerHTML = safeText;
            }
            box.style.color = textColor === 'var(--text-light)' ? '#ffffff' : textColor;
            box.style.fontFamily = font;
            box.style.fontSize = size;
        };

        window.openTickerConfig = function() {
            if(!window.isAuthorized) return;
            const h = window.pageContentData?.header || {};
            if(document.getElementById('hcLogoRed')) document.getElementById('hcLogoRed').value = h.title_red || 'RED';
            if(document.getElementById('hcLogoSub')) document.getElementById('hcLogoSub').value = h.title_sub || 'ZULASSUNGSDIENST & SCHILDER';
            if(document.getElementById('hcCarType')) document.getElementById('hcCarType').value = h.icon_car || 'svg-sport';
            if(document.getElementById('hcCarAnim')) document.getElementById('hcCarAnim').value = h.car_anim || 'car-anim-idle';
            if(document.getElementById('hcCarColor')) document.getElementById('hcCarColor').value = h.car_color || 'var(--text-light)';
            window.updateTickerStudioPreview();
            document.getElementById('tickerConfigOverlay').classList.add('open');
        };
        window.closeTickerConfig = function() {
            document.getElementById('tickerConfigOverlay').classList.remove('open');
        };
        
        window.tickerIsVisible = true;
        window.toggleTickerDisplay = function() {
            window.tickerIsVisible = !window.tickerIsVisible;
            document.getElementById('ticker-container').style.display = window.tickerIsVisible ? 'block' : 'none';
            setTimeout(window.syncHeaderHeight, 50);
            window.closeTickerConfig();
            window.showToast(window.tickerIsVisible ? 'Ticker aktiviert' : 'Ticker deaktiviert', 'success');
            
            try { setDoc(doc(db, "settings", "ticker_state"), { isVisible: window.tickerIsVisible }, {merge: true}); } catch(e){}
        };
        
        window.saveTickerConfig = async function() {
            if(!window.pageContentData.header) window.pageContentData.header = {};
            window.pageContentData.header.title_red = document.getElementById('hcLogoRed')?.value || 'RED';
            window.pageContentData.header.title_sub = document.getElementById('hcLogoSub')?.value || 'ZULASSUNGSDIENST';
            window.pageContentData.header.icon_car = document.getElementById('hcCarType')?.value || 'svg-sport';
            window.pageContentData.header.car_anim = document.getElementById('hcCarAnim')?.value || 'car-anim-idle';
            window.pageContentData.header.car_color = document.getElementById('hcCarColor')?.value || 'var(--text-light)';
            
            localStorage.setItem('red_page_content', JSON.stringify(window.pageContentData));
            window.applyPageContent(window.pageContentData);
            try { await setDoc(doc(db, "settings", "page_content"), window.pageContentData, {merge: true}); } catch(e){}

            const fullText = document.getElementById('tickerFullText').value;
            const blinkWord = document.getElementById('tickerBlinkWord').value.trim();
            const speed = document.getElementById('tickerSpeed').value;
            const color = document.getElementById('tickerColor').value;
            const blinkColor = document.getElementById('tickerBlinkColor').value;
            const font = document.getElementById('tickerFont').value;
            const size = document.getElementById('tickerSize').value;
            
            const symbolMap = {
                'symCar': {icon: 'fa-car-side', col: 'var(--text-light)'},
                'symMotorcycle': {icon: 'fa-motorcycle', col: 'var(--text-light)'},
                'symTruck': {icon: 'fa-truck', col: 'var(--text-light)'},
                'symCard': {icon: 'fa-id-card', col: 'var(--text-light)'},
                'symBolt': {icon: 'fa-bolt', col: '#ff9500'},
                'symFlag': {icon: 'fa-flag-checkered', col: 'var(--text-light)'},
                'symStar': {icon: 'fa-star', col: '#ff9500'},
                'symKey': {icon: 'fa-key', col: 'var(--text-light)'},
                'symClock': {icon: 'fa-clock', col: 'var(--text-light)'},
                'symFire': {icon: 'fa-fire', col: '#ff9500'},
                'symInfo': {icon: 'fa-circle-info', col: '#007aff'},
                'symCalendar': {icon: 'fa-calendar', col: 'var(--text-light)'},
                'symPin': {icon: 'fa-thumbtack', col: 'var(--primary-red)'},
                'symHand': {icon: 'fa-handshake', col: '#25D366'},
                'symMedal': {icon: 'fa-medal', col: '#ff9500'}
            };
            
            const symbols = [];
            for (const [id, data] of Object.entries(symbolMap)) {
                if(document.getElementById(id) && document.getElementById(id).checked) {
                    symbols.push(data);
                }
            }
            
            try {
                await setDoc(doc(db, "settings", "ticker"), {
                    fullText, blinkWord, speed, color, blinkColor, font, size, symbols, timestamp: Date.now()
                });
                window.showToast('Header-Auto, Logo & Ticker gespeichert!', 'success');
            } catch(e) {
                applyTickerLocally({ fullText, blinkWord, speed, color, blinkColor, font, size, symbols });
                window.showToast('Header & Ticker aktualisiert!', 'success');
            }
            window.closeTickerConfig(); 
            setTimeout(window.syncHeaderHeight, 80);
        };

        function applyTickerLocally(data) {
            const contentEl = document.getElementById('tickerTextContent');
            const wrapperEl = document.getElementById('tickerWrapper');
            
            let symLeft = '';
            let symRight = '';
            if(data.symbols && data.symbols.length > 0) {
                data.symbols.forEach(s => {
                    const iclass = typeof s === 'string' ? s : s.icon;
                    const icolor = typeof s === 'string' ? 'var(--primary-red)' : s.col;
                    symLeft += `<i class="fa-solid ${iclass} ticker-car" style="margin-right:8px; color:${icolor};"></i>`;
                    symRight += `<i class="fa-solid ${iclass} ticker-car" style="margin-left:8px; color:${icolor};"></i>`;
                });
            }
            
            let textHtml = '';
            if(data.blinkWord && data.blinkWord !== '' && data.fullText.includes(data.blinkWord)) {
                const parts = data.fullText.split(data.blinkWord);
                textHtml = `${parts[0]}<span class="ticker-highlight" style="color:${data.blinkColor};">${data.blinkWord}</span>${parts[1]}`;
            } else {
                textHtml = data.fullText || '';
            }
            
            contentEl.innerHTML = `${symLeft} <span>${textHtml}</span> ${symRight}`;
            contentEl.style.color = data.color || 'var(--text-light)';
            contentEl.style.fontFamily = data.font || "'Montserrat', sans-serif";
            contentEl.style.fontSize = data.size || "12.5px";
            wrapperEl.style.animationDuration = data.speed || "15s";
        }

        onSnapshot(doc(db, "settings", "ticker"), (docSnap) => {
            if(docSnap.exists()) {
                applyTickerLocally(docSnap.data());
                
                const data = docSnap.data();
                document.getElementById('tickerFullText').value = data.fullText || '';
                document.getElementById('tickerBlinkWord').value = data.blinkWord || '';
                document.getElementById('tickerSpeed').value = data.speed || '15s';
                document.getElementById('tickerColor').value = data.color || 'var(--text-light)';
                document.getElementById('tickerBlinkColor').value = data.blinkColor || '#e60000';
                document.getElementById('tickerFont').value = data.font || "'Montserrat', sans-serif";
                document.getElementById('tickerSize').value = data.size || '13px';
                
                if(data.symbols) {
                    const symbolsJson = JSON.stringify(data.symbols);
                    document.getElementById('symCar').checked = symbolsJson.includes('fa-car-side');
                    document.getElementById('symMotorcycle').checked = symbolsJson.includes('fa-motorcycle');
                    document.getElementById('symTruck').checked = symbolsJson.includes('fa-truck');
                    document.getElementById('symCard').checked = symbolsJson.includes('fa-id-card');
                    document.getElementById('symBolt').checked = symbolsJson.includes('fa-bolt');
                    document.getElementById('symFlag').checked = symbolsJson.includes('fa-flag-checkered');
                    document.getElementById('symStar').checked = symbolsJson.includes('fa-star');
                    document.getElementById('symKey').checked = symbolsJson.includes('fa-key');
                    document.getElementById('symClock').checked = symbolsJson.includes('fa-clock');
                    document.getElementById('symFire').checked = symbolsJson.includes('fa-fire');
                    document.getElementById('symInfo').checked = symbolsJson.includes('fa-circle-info');
                    document.getElementById('symCalendar').checked = symbolsJson.includes('fa-calendar');
                    document.getElementById('symPin').checked = symbolsJson.includes('fa-thumbtack');
                    document.getElementById('symHand').checked = symbolsJson.includes('fa-handshake');
                    document.getElementById('symMedal').checked = symbolsJson.includes('fa-medal');
                }
            }
        });
        
        onSnapshot(doc(db, "settings", "ticker_state"), (docSnap) => {
             if(docSnap.exists()) {
                 window.tickerIsVisible = docSnap.data().isVisible;
                 document.getElementById('ticker-container').style.display = window.tickerIsVisible ? 'block' : 'none';
                 setTimeout(window.syncHeaderHeight, 50);
             }
        });

        // =========================================================================
        // 8-VIERECKE LIVE-LEADS MONITORING & GELB-GOLDENE PIN-MARKIERUNG
        // =========================================================================
        let isFirstLoadApts = true; 
        window.activeBadgeNum = 0;
        let localAppointments = JSON.parse(localStorage.getItem('red_local_apts') || '[]');
        
        function updateBadgeDisplay(hasPrio, count) {
            const b = document.getElementById('notif-badge');
            if(!b) return;
            b.innerText = count;
            b.style.display = count > 0 ? 'flex' : 'none';
            b.classList.remove('prio-pulse');
            if(hasPrio) b.classList.add('prio-pulse');
        }
        
        function parseAptDateParts(dateStr) {
            if (!dateStr) return null;
            const s = String(dateStr).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                const p = s.substring(0, 10).split('-');
                return { year: parseInt(p[0], 10), month: parseInt(p[1], 10) - 1, day: parseInt(p[2], 10) };
            }
            if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(s)) {
                const p = s.split('.');
                return { year: parseInt(p[2], 10), month: parseInt(p[1], 10) - 1, day: parseInt(p[0], 10) };
            }
            return null;
        }

        function formatAptDateDE(dateStr) {
            const p = parseAptDateParts(dateStr);
            if (!p || isNaN(p.day) || isNaN(p.month) || isNaN(p.year)) return dateStr || '-';
            return `${String(p.day).padStart(2, '0')}.${String(p.month + 1).padStart(2, '0')}.${p.year}`;
        }

        function getAptTimestamp(dateStr, timeStr) {
            const p = parseAptDateParts(dateStr);
            if (!p) return 0;
            let hour = 20, min = 0;
            if (timeStr && String(timeStr).includes(':')) {
                const tMatch = String(timeStr).match(/(\d{1,2}):(\d{2})/);
                if (tMatch) {
                    hour = parseInt(tMatch[1], 10);
                    min = parseInt(tMatch[2], 10);
                }
            }
            return new Date(p.year, p.month, p.day, hour, min, 0).getTime();
        }

        function isAptExpired(dateStr, timeStr) {
            const ts = getAptTimestamp(dateStr, timeStr);
            return ts > 0 && ts < Date.now();
        }

        function isAptToday(dateStr) {
            const p = parseAptDateParts(dateStr);
            if (!p) return false;
            const now = new Date();
            return p.day === now.getDate() && p.month === now.getMonth() && p.year === now.getFullYear();
        }

        async function syncAppointmentToCRM(apt, markCompleted = false) {
            if (!apt || !window.isAuthorized) return null;
            const cleanEmail = (apt.email || '').trim().toLowerCase();
            const cleanPhone = (apt.phone || '').replace(/\D/g, '');
            const cleanName = (apt.name || '').trim().toLowerCase();

            let existingId = null;
            let maxIdNum = 0;
            for (const key in (window.crmClientsDetail || {})) {
                const c = window.crmClientsDetail[key];
                if (c.clientId && c.clientId.startsWith('RED-')) {
                    const num = parseInt(c.clientId.replace(/\D/g, ''), 10);
                    if (!isNaN(num) && num < 1000000 && num > maxIdNum) maxIdNum = num;
                }
                const cEmail = (c.email || '').trim().toLowerCase();
                const cPhone = (c.phone || '').replace(/\D/g, '');
                const cName = (c.name || '').trim().toLowerCase();
                if ((cleanEmail && cleanEmail.includes('@') && cEmail === cleanEmail) ||
                    (cleanPhone.length >= 6 && cPhone === cleanPhone) ||
                    (cleanName && cName === cleanName)) {
                    existingId = key;
                }
            }

            const niceDate = formatAptDateDE(apt.date);
            const code = apt.trackingCode || ((apt.notes || []).map(nt => (String(nt.text || '').match(/RED-\d{6}/) || [])[0]).find(Boolean)) || '';
            const statusPrefix = markCompleted ? '✅ Erledigt' : '📅 Termin';
            const entryLine = `${statusPrefix} (${niceDate}): ${apt.service || 'Zulassung'}${apt.wunschkennzeichen ? ' | Kennz.: ' + apt.wunschkennzeichen : ''}${code ? ' [' + code + ']' : ''}`;

            let targetId = existingId;
            if (existingId) {
                const client = window.crmClientsDetail[existingId];
                const syncedIds = Array.isArray(client.syncedAptIds) ? client.syncedAptIds : [];
                if (!syncedIds.includes(apt.id)) {
                    client.bookings = (client.bookings || 1) + 1;
                    syncedIds.push(apt.id);
                    client.syncedAptIds = syncedIds;
                }
                if (apt.category && !client.category) client.category = apt.category;
                const prevNotes = client.notes || '';
                if (!prevNotes.includes(entryLine)) {
                    client.notes = prevNotes ? `${prevNotes}\n${entryLine}` : entryLine;
                }
                client.timestamp = Date.now();
            } else {
                maxIdNum++;
                targetId = 'RED-' + maxIdNum.toString().padStart(9, '0').replace(/(\d{3})(?=\d)/g, '$1 ');
                window.crmClientsDetail[targetId] = {
                    clientId: targetId,
                    category: apt.category || 'Privatkunde',
                    name: apt.name || 'Unbekannt',
                    phone: apt.phone || '',
                    email: (apt.email && apt.email.includes('@')) ? apt.email : '',
                    birthday: '',
                    address: '',
                    city: '',
                    notes: entryLine,
                    bookings: 1,
                    syncedAptIds: [apt.id],
                    timestamp: Date.now()
                };
            }

            try {
                await setDoc(doc(db, "settings", "crm_details"), { details: { [targetId]: window.crmClientsDetail[targetId] } }, { merge: true });
            } catch (e) {}
            if (document.getElementById('kpiTotalCrm')) {
                document.getElementById('kpiTotalCrm').innerText = Object.keys(window.crmClientsDetail || {}).length;
            }
            return targetId;
        }

        window.openClientInCrmFromApt = async function(aptId) {
            const isSup = document.body.classList.contains('is-supervisor');
            if (!isSup && !window.adminPermissions?.crm) {
                window.showToast('Kunden-CRM ist durch den Supervisor gesperrt.', 'error');
                return;
            }
            const apt = (window.redApts || []).find(a => a.id === aptId);
            if (!apt) return;
            const clientId = await syncAppointmentToCRM(apt, Number(apt.orderStatus) === 4);
            if (clientId) {
                window.openCRMDetail(clientId);
                window.showToast(`Kundenakte ${clientId} geladen.`, 'success');
            }
        };

        window.setAptOrderStatus = async function(id, step) {
            try {
                const apt = (window.redApts || []).find(a => a.id === id);
                const updatePayload = { orderStatus: step };
                if (step === 4 && apt?.marked) updatePayload.marked = false;

                await updateDoc(doc(db, "appointments", id), updatePayload);

                const resolvedCode = apt?.trackingCode || ((apt?.notes || []).map(nt => (String(nt.text || '').match(/RED-\d{6}/) || [])[0]).find(Boolean)) || '';
                if (resolvedCode) {
                    await setDoc(doc(db, "order_tracking", resolvedCode), {
                        code: resolvedCode,
                        date: formatAptDateDE(apt?.date || ''),
                        timeLabel: apt?.timeLabel || '',
                        service: apt?.service || 'Kfz-Zulassung',
                        wunschkennzeichen: apt?.wunschkennzeichen || '',
                        orderStatus: step,
                        updatedAt: Date.now()
                    }, { merge: true }).catch(() => {});
                }

                if (step === 4 && apt) {
                    await syncAppointmentToCRM(apt, true);
                    window.showToast('✅ Auftrag erledigt, im Kunden-CRM gesichert & ins Archiv verschoben!', 'success');
                } else {
                    window.showToast(`Auftragsstatus auf Stufe ${step} aktualisiert!`, 'success');
                }
            } catch(e) {
                window.showToast('Status konnte nicht gespeichert werden.', 'error');
            }
        };

        window.sendGoogleReviewWhatsApp = function(aptId) {
            const apt = (window.redApts || []).find(a => a.id === aptId);
            if (!apt) return;
            const cleanDigits = (apt.phone || '').replace(/\D/g, '');
            if (cleanDigits.length < 5) {
                window.showToast('Keine gültige Telefonnummer hinterlegt.', 'error');
                return;
            }
            const reviewUrl = (window.dynamicContactData?.googleReview || '').trim();
            if (!reviewUrl || !reviewUrl.startsWith('http')) {
                window.showToast('Bitte zuerst unter „Firmendaten“ deinen Google-Bewertungslink eintragen & speichern!', 'error');
                return;
            }
            const waNumber = cleanDigits.replace(/^0/, '49');
            const msg = `Hallo ${apt.name}, vielen Dank für Ihr Vertrauen in den RED Zulassungsdienst Berlin! 🚗✨\n\nWenn Sie mit unserem Service zufrieden waren, freuen wir uns riesig über eine kurze 5-Sterne-Bewertung auf Google (dauert nur 20 Sekunden):\n👉 ${reviewUrl}\n\nAllzeit gute Fahrt wünscht Ihnen Tamer Yazici & Team!`;
            window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        };

        window.openInvoiceFromApt = function(aptId) {
            const idx = (window.redApts || []).findIndex(a => a.id === aptId);
            if (idx === -1) return;
            window.resetCashInvoiceForm();
            window.openCashInvoiceModal('create');
            setTimeout(() => {
                const pick = document.getElementById('invClientQuickPick');
                if (pick) pick.value = `apt:${idx}`;
                window.fillInvoiceFromQuickPick(`apt:${idx}`);
                if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            }, 90);
        };

        window.printOrderSlip = function(aptId) {
            const apt = (window.redApts || []).find(a => a.id === aptId);
            if (!apt) return;

            const esc = window.escHtml;
            const niceDate = formatAptDateDE(apt.date);
            const displayTime = apt.timeLabel === "Ganztägig"
                ? "Ganztägig"
                : (apt.timeLabel && apt.timeLabel.includes("Uhr") ? apt.timeLabel : (apt.timeLabel || '-') + " Uhr");
            const resolvedCode = apt.trackingCode || ((apt.notes || []).map(nt => (String(nt.text || '').match(/RED-\d{6}/) || [])[0]).find(Boolean)) || '—';
            const printDate = new Date().toLocaleDateString('de-DE');

            const extraNotes = (apt.notes || [])
                .filter(n => {
                    const t = String(n.text || '');
                    return !(resolvedCode !== '—' && t.includes(resolvedCode) && n.timeStr === 'Automatisch vergeben')
                        && !(apt.wunschkennzeichen && t.includes(apt.wunschkennzeichen) && n.timeStr === 'Bei Buchung gewählt')
                        && !(apt.customNote && t.includes(apt.customNote) && n.timeStr === 'Bei Buchung angegeben');
                })
                .map(n => `• ${esc(n.text)}`)
                .join('<br>');

            const win = window.open('', '_blank');
            if (!win) {
                window.showToast('Bitte Pop-ups erlauben, um den Laufzettel zu drucken.', 'error');
                return;
            }

            win.document.write(`
                <!DOCTYPE html>
                <html lang="de">
                <head>
                    <meta charset="UTF-8">
                    <title>Laufzettel ${esc(resolvedCode)} – ${esc(apt.name)}</title>
                    <style>
                        @page { margin: 12mm; }
                        * { box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 20px; max-width: 760px; margin-left: auto; margin-right: auto; font-size: 12.5px; line-height: 1.45; }
                        .top-tools { background: #14141c; color: #fff; padding: 10px 16px; border-radius: 8px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
                        .top-tools button { background: #d90000; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 800; cursor: pointer; font-size: 12px; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d90000; padding-bottom: 10px; margin-bottom: 14px; }
                        .brand { font-size: 20px; font-weight: 900; color: #d90000; letter-spacing: 0.5px; }
                        .brand span { color: #111; font-size: 13px; display: block; font-weight: 800; letter-spacing: 1px; }
                        .code-badge { border: 2px dashed #d90000; padding: 6px 14px; border-radius: 8px; text-align: right; background: #fff7f7; }
                        .code-badge small { display: block; font-size: 9px; text-transform: uppercase; color: #555; font-weight: 700; }
                        .code-badge strong { font-family: 'Courier New', monospace; font-size: 18px; color: #d90000; letter-spacing: 1px; }
                        .box { border: 1.5px solid #222; border-radius: 8px; padding: 11px 14px; margin-bottom: 12px; }
                        .box-title { font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.6px; color: #d90000; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
                        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
                        .field small { display: block; font-size: 9.5px; text-transform: uppercase; color: #666; font-weight: 700; }
                        .field strong { font-size: 13.5px; color: #111; }
                        .plate-box { display: inline-flex; align-items: center; border: 2.5px solid #111; border-radius: 5px; overflow: hidden; font-family: 'Courier New', monospace; font-weight: 900; font-size: 16px; margin-top: 3px; background: #fff; }
                        .plate-box .eu { background: #003399; color: #fff; padding: 3px 6px; font-size: 10px; font-family: Arial, sans-serif; }
                        .plate-box .val { padding: 2px 10px; letter-spacing: 1px; }
                        .check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 14px; font-size: 12px; }
                        .chk-item { display: flex; align-items: center; gap: 8px; }
                        .chk-sq { width: 15px; height: 15px; border: 1.8px solid #111; border-radius: 3px; display: inline-block; flex-shrink: 0; }
                        .pay-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 4px; }
                        .pay-cell { border: 1px solid #bbb; border-radius: 6px; padding: 7px 10px; background: #fafafa; }
                        .pay-cell small { display: block; font-size: 9.5px; text-transform: uppercase; color: #555; font-weight: 700; }
                        .pay-cell .line { margin-top: 10px; border-bottom: 1.2px solid #222; text-align: right; font-weight: 800; }
                        .notes-lines { margin-top: 6px; }
                        .notes-lines div { border-bottom: 1px dotted #888; height: 22px; }
                        .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 22px; }
                        .sig-col { border-top: 1.5px solid #111; padding-top: 4px; font-size: 10.5px; text-align: center; color: #333; }
                        @media print { .top-tools { display: none !important; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="top-tools">
                        <span><strong>RED Mappen-Laufzettel:</strong> Optimiert für DIN A4 &amp; DIN A5</span>
                        <button onclick="window.print()">🖨️ Jetzt drucken</button>
                    </div>

                    <div class="header">
                        <div class="brand">
                            RED ZULASSUNGSDIENST BERLIN
                            <span>AUFTRAGS-LAUFZETTEL / KUNDENMAPPE • Kienitzer Str. 6, 12053 Berlin</span>
                        </div>
                        <div class="code-badge">
                            <small>Auftrags-Code (Live-Tracker)</small>
                            <strong>${esc(resolvedCode)}</strong>
                        </div>
                    </div>

                    <div class="box">
                        <div class="box-title">1. Kunden- &amp; Auftragsdaten</div>
                        <div class="grid-2">
                            <div class="field"><small>Kunde / Auftraggeber (${esc(apt.category || 'Privatkunde')})</small><strong>${esc(apt.name || '-')}</strong></div>
                            <div class="field"><small>Termin / Abgabe</small><strong>${esc(niceDate)} • ${esc(displayTime)}</strong></div>
                            <div class="field"><small>Telefon / WhatsApp</small><strong>${esc(apt.phone || '-')}</strong></div>
                            <div class="field"><small>E-Mail</small><strong>${esc(apt.email || '-')}</strong></div>
                            <div class="field"><small>Gewünschte Leistung</small><strong>${esc(apt.service || '-')}</strong></div>
                            <div class="field">
                                <small>Wunschkennzeichen</small>
                                ${apt.wunschkennzeichen
                                    ? `<div class="plate-box"><span class="eu">D</span><span class="val">${esc(apt.wunschkennzeichen)}</span></div>`
                                    : `<strong>— (Kein Wunschkennzeichen)</strong>`}
                            </div>
                        </div>
                        ${apt.customNote ? `<div style="margin-top:8px; padding:6px 10px; background:#fff4f4; border-left:3px solid #d90000; font-size:11.5px;"><strong>Kunden-Hinweis:</strong> ${esc(apt.customNote)}</div>` : ''}
                        ${extraNotes ? `<div style="margin-top:6px; padding:6px 10px; background:#f6f6f9; border-left:3px solid #555; font-size:11.5px;"><strong>Interne Notizen:</strong><br>${extraNotes}</div>` : ''}
                    </div>

                    <div class="box">
                        <div class="box-title">2. Eingereichte Original-Unterlagen &amp; Schilder (Abgabecheck)</div>
                        <div class="check-grid">
                            <div class="chk-item"><span class="chk-sq"></span> ZB Teil I (Fahrzeugschein)</div>
                            <div class="chk-item"><span class="chk-sq"></span> ZB Teil II (Fahrzeugbrief)</div>
                            <div class="chk-item"><span class="chk-sq"></span> Ausweis / Pass (+ Meldebesch. / Gewerbe)</div>
                            <div class="chk-item"><span class="chk-sq"></span> eVB-Nr.: _______________________</div>
                            <div class="chk-item"><span class="chk-sq"></span> Gültiger TÜV / HU-Bericht</div>
                            <div class="chk-item"><span class="chk-sq"></span> Vollmacht &amp; SEPA-Mandat unterschrieben</div>
                            <div class="chk-item"><span class="chk-sq"></span> Alte Kennzeichen (Anzahl: _____)</div>
                            <div class="chk-item"><span class="chk-sq"></span> Neue Schilder (Anz.: ___) &nbsp;<span class="chk-sq"></span> Plakette</div>
                        </div>
                    </div>

                    <div class="box">
                        <div class="box-title">3. Abrechnung (Barzahlung) &amp; LABO-Status</div>
                        <div class="pay-row">
                            <div class="pay-cell"><small>LABO Behördengebühr</small><div class="line">€</div></div>
                            <div class="pay-cell"><small>Service &amp; Schilder</small><div class="line">€</div></div>
                            <div class="pay-cell" style="border-color:#d90000; background:#fff7f7;"><small style="color:#d90000;">Gesamtbetrag (Bar)</small><div class="line">€</div></div>
                        </div>
                        <div style="display:flex; gap:18px; flex-wrap:wrap; margin-top:10px; font-size:11.5px; font-weight:700;">
                            <div class="chk-item"><span class="chk-sq"></span> Bezahlt bei Abgabe</div>
                            <div class="chk-item"><span class="chk-sq"></span> Zahlung bei Abholung</div>
                            <div class="chk-item"><span class="chk-sq"></span> Beim LABO eingereicht</div>
                            <div class="chk-item"><span class="chk-sq"></span> Abholbereit gemeldet</div>
                        </div>
                        <div class="notes-lines">
                            <div></div>
                            <div></div>
                        </div>
                    </div>

                    <div class="sig-row">
                        <div class="sig-col">Berlin, ${printDate} – Annahme RED (Tamer Yazici)</div>
                        <div class="sig-col">Datum &amp; Unterschrift Kunde (Papiere &amp; Schilder erhalten)</div>
                    </div>
                </body>
                </html>
            `);
            win.document.close();
        };

        function buildAdminAppointmentCard(apt, ctx) {
            const id = apt.id;
            const curStep = Number(apt.orderStatus) || 1;
            const isDone = (curStep === 4);
            const isLabo = (!isDone && (curStep === 2 || curStep === 3));
            const isExpired = isAptExpired(apt.date, apt.timeLabel);
            const isTodayDate = isAptToday(apt.date);
            const niceDate = formatAptDateDE(apt.date);

            let prioClass = 'prio-normal';
            let badgeText = '📅 Geplant';
            let statusCat = 'planned';

            if (isDone) {
                prioClass = 'prio-done';
                badgeText = '✅ Erledigt';
                statusCat = 'done';
            } else if (isLabo) {
                prioClass = 'prio-labo';
                badgeText = curStep === 3 ? '🪪 Schilder bereit' : '🏛️ Beim LABO';
                statusCat = isTodayDate ? 'today' : 'planned';
            } else if (isExpired) {
                prioClass = 'prio-expired';
                badgeText = '⌛ Zeit vorbei';
                statusCat = 'expired';
            } else if (isTodayDate) {
                prioClass = 'prio-high';
                badgeText = '🔥 Heute Fällig';
                statusCat = 'today';
            }

            const markedClass = apt.marked ? 'marked' : '';
            const card = document.createElement('div');
            card.className = `admin-apt-card ${prioClass} ${markedClass}`;
            card.id = id;
            card.setAttribute('data-status-cat', statusCat);
            card.setAttribute('data-pinned', apt.marked ? 'true' : 'false');
            card.setAttribute('data-labo', isLabo ? 'true' : 'false');

            const resolvedCode = apt.trackingCode || ((apt.notes || []).map(nt => (String(nt.text || '').match(/RED-\d{6}/) || [])[0]).find(Boolean)) || '';

            // Automatisch erzeugte Doppel-Notizen ausblenden, wenn sie schon oben als farbige Badges stehen
            let notesHtml = '';
            if (apt.notes && apt.notes.length > 0) {
                apt.notes.forEach(note => {
                    const t = String(note.text || '');
                    const isDupCode = resolvedCode && t.includes(resolvedCode) && note.timeStr === 'Automatisch vergeben';
                    const isDupPlate = apt.wunschkennzeichen && t.includes(apt.wunschkennzeichen) && note.timeStr === 'Bei Buchung gewählt';
                    const isDupHint = apt.customNote && t.includes(apt.customNote) && note.timeStr === 'Bei Buchung angegeben';
                    if (isDupCode || isDupPlate || isDupHint) return;

                    notesHtml += `
                        <div class="saved-note-row" id="note-${note.id}">
                            <div style="flex:1;">
                                <span class="note-text-body">${window.escHtml(note.text)}</span>
                                <span class="note-meta">${window.escHtml(note.timeStr || '')}</span>
                            </div>
                            <div class="note-row-actions">
                                <button class="note-row-btn" onclick="window.triggerEditNote('note-${note.id}', '${id}')" title="Notiz bearbeiten"><i class="fa-solid fa-pencil"></i></button>
                                <button class="note-row-btn del" onclick="window.triggerDeleteNote('note-${note.id}', '${id}')" title="Notiz löschen"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    `;
                });
            }

            const displayTime = apt.timeLabel === "Ganztägig"
                ? "Ganztägig"
                : (apt.timeLabel && apt.timeLabel.includes("Uhr") ? apt.timeLabel : (apt.timeLabel || '') + " Uhr");
            const createdStr = apt.timestamp
                ? `Gebucht: ${new Date(apt.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • ${new Date(apt.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
                : '';

            const categoryTag = apt.category
                ? `<span style="font-size:9.5px; background:var(--bg-input); border:1px solid var(--glass-border); padding:2px 8px; border-radius:6px; color:var(--text-muted); font-weight:800;">${window.escHtml(apt.category)}</span>`
                : '';
            const pinnedBadgeIndicator = apt.marked
                ? `<span style="font-size:9.5px; background:#f5c542; color:#000; padding:2px 7px; border-radius:6px; font-weight:900;"><i class="fa-solid fa-thumbtack"></i> GEPINNT</span>`
                : '';
            const codeBadgeIndicator = resolvedCode
                ? `<span class="apt-code-chip" onclick="navigator.clipboard?.writeText('${resolvedCode}'); window.showToast('Auftrags-Code ${resolvedCode} kopiert!', 'success');" title="Klicken zum Kopieren"><i class="fa-solid fa-satellite-dish"></i> ${window.escHtml(resolvedCode)}</span>`
                : '';

            const highlightPills = [
                apt.wunschkennzeichen ? `<span class="apt-plate-pill"><i class="fa-solid fa-id-card"></i> ${window.escHtml(apt.wunschkennzeichen)}</span>` : '',
                apt.customNote ? `<span class="apt-hint-pill"><i class="fa-solid fa-tag"></i> ${window.escHtml(apt.customNote)}</span>` : ''
            ].filter(Boolean).join('');

            let callBtn = '';
            let waConfirmBtn = '';
            let reviewBtn = '';
            const cleanDigits = (apt.phone || '').replace(/\D/g, '');
            if (cleanDigits.length >= 5) {
                const waNumber = cleanDigits.replace(/^0/, '49');
                callBtn = `<a href="tel:${window.escHtml(apt.phone)}" class="apt-btn call-btn" title="Kunden direkt anrufen"><i class="fa-solid fa-phone"></i></a>`;
                const platePart = apt.wunschkennzeichen ? ` (${apt.wunschkennzeichen})` : '';
                const codePart = resolvedCode ? ` | Auftrags-Code: ${resolvedCode}` : '';
                const waText = curStep >= 3
                    ? `Hallo ${apt.name}, gute Nachricht von Ihrem RED Zulassungsdienst Berlin! Ihre Zulassung (${apt.service}${platePart}) ist fertig und abholbereit in der Kienitzer Str. 6, 12053 Berlin (Mo–Fr 09:00–20:00 Uhr).`
                    : `Hallo ${apt.name}, hier ist Ihr RED Zulassungsdienst Berlin. Wir bestätigen Ihren Termin am ${niceDate} um ${displayTime} (${apt.service}${platePart}${codePart}). Bitte bringen Sie alle Originalunterlagen mit. Adresse: Kienitzer Str. 6, 12053 Berlin.`;
                waConfirmBtn = `<a href="https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener noreferrer" class="apt-btn wa-confirm" title="${curStep >= 3 ? 'Abholbereit per WhatsApp melden' : 'Termin per WhatsApp bestätigen'}"><i class="fa-brands fa-whatsapp"></i></a>`;
                reviewBtn = `<button type="button" class="apt-btn" style="color:#d97706; border-color:rgba(217,119,6,0.45);" onclick="window.sendGoogleReviewWhatsApp('${id}')" title="Google-Bewertung per WhatsApp anfragen"><i class="fa-solid fa-star"></i></button>`;
            }

            const emailCell = (apt.email && apt.email.includes('@'))
                ? `<a href="mailto:${window.escHtml(apt.email)}" title="${window.escHtml(apt.email)}">${window.escHtml(apt.email)}</a>`
                : window.escHtml(apt.email || '-');
            const phoneCell = cleanDigits.length >= 5
                ? `<a href="tel:${window.escHtml(apt.phone)}">${window.escHtml(apt.phone)}</a>`
                : window.escHtml(apt.phone || '-');

            card.innerHTML = `
                <div class="apt-head-row">
                    <div class="apt-badges-group">
                        <div class="prio-badge">${badgeText}</div>
                        ${codeBadgeIndicator}
                        ${categoryTag}
                        ${pinnedBadgeIndicator}
                    </div>
                    <div class="apt-actions-horizontal">
                        ${callBtn}
                        ${waConfirmBtn}
                        ${reviewBtn}
                        <button type="button" class="apt-btn" onclick="window.printOrderSlip('${id}')" title="Laufzettel / Mappen-Deckblatt drucken"><i class="fa-solid fa-print"></i></button>
                        <button type="button" class="apt-btn mod-invoice" style="color:var(--green-accent); border-color:var(--green-border);" onclick="window.openInvoiceFromApt('${id}')" title="Bar-Rechnung (PDF) direkt für diesen Kunden erstellen"><i class="fa-solid fa-file-invoice-dollar"></i></button>
                        <button type="button" class="apt-btn crm-sync mod-crm" onclick="window.openClientInCrmFromApt('${id}')" title="Kundenakte im CRM öffnen / sichern"><i class="fa-solid fa-address-book"></i></button>
                        <button type="button" class="apt-btn done-btn" onclick="window.setAptOrderStatus('${id}', ${isDone ? 1 : 4})" title="${isDone ? 'Wieder als Offen zurückholen' : 'Als Erledigt abschließen & ins Archiv verschieben'}"><i class="fa-solid ${isDone ? 'fa-rotate-left' : 'fa-check'}"></i></button>
                        <button type="button" class="apt-btn mark ${apt.marked ? 'is-pinned' : ''}" onclick="window.markApt('${id}', ${!apt.marked})" title="${apt.marked ? 'Von Pinnwand lösen' : 'Auf Bildschirm anheften'}"><i class="fa-solid fa-thumbtack"></i></button>
                        <button type="button" class="apt-btn edit" onclick="window.editAptNotes('${id}')" title="Notiz hinzufügen"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="apt-btn edit" style="border-color:#007aff; color:#007aff;" onclick="window.openEditAptModal('${id}')" title="Termin verschieben"><i class="fa-solid fa-calendar-day"></i></button>
                        <button type="button" class="apt-btn delete" onclick="window.deleteApt('${id}')" title="Termin löschen"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>

                <div class="apt-title-row">
                    <h4>${window.escHtml(apt.service)}</h4>
                    ${createdStr ? `<span class="apt-meta-time">${createdStr}</span>` : ''}
                </div>
                ${highlightPills ? `<div class="apt-highlight-row">${highlightPills}</div>` : ''}

                <div class="apt-grid-info">
                    <div><i class="fa-solid fa-user"></i> <span>${window.escHtml(apt.name)}</span></div>
                    <div><i class="fa-solid fa-clock"></i> <strong>${window.escHtml(niceDate)}</strong> • ${window.escHtml(displayTime)}</div>
                    <div><i class="fa-solid fa-phone"></i> ${phoneCell}</div>
                    <div><i class="fa-solid fa-envelope"></i> ${emailCell}</div>
                </div>

                <div class="apt-status-bar">
                    <button type="button" class="status-pill-btn step-1 ${curStep===1?'active':''}" onclick="window.setAptOrderStatus('${id}', 1)">1. Erfasst</button>
                    <button type="button" class="status-pill-btn step-2 ${curStep===2?'active':''}" onclick="window.setAptOrderStatus('${id}', 2)">2. Beim LABO</button>
                    <button type="button" class="status-pill-btn step-3 ${curStep===3?'active':''}" onclick="window.setAptOrderStatus('${id}', 3)">3. Schilder geprägt</button>
                    <button type="button" class="status-pill-btn step-4 ${curStep===4?'active':''}" onclick="window.setAptOrderStatus('${id}', 4)">4. Abgeschlossen</button>
                </div>

                ${notesHtml ? `<div class="notes-list-box" id="notes-container-${id}">${notesHtml}</div>` : `<div class="notes-list-box" id="notes-container-${id}"></div>`}
                <input type="text" class="admin-note-input" id="note-input-${id}" placeholder="Interne Notiz eingeben und Enter drücken..." onkeypress="window.saveNote(event, this, '${id}')">
            `;

            // Pinnwand-Kennzeichen (nur für angeheftete Aufträge)
            if (apt.marked && ctx.pinContainer) {
                const plate = document.createElement('div');
                let plateStateClass = 'normal-day';
                if (isExpired || isDone) plateStateClass = 'expired-plate';
                else if (isTodayDate) plateStateClass = 'urgent-today';

                plate.className = `pinned-plate ${plateStateClass}`;
                plate.id = 'pinned-' + id;
                plate.title = 'Mit Maus oder Finger frei über den Bildschirm ziehen';
                plate.innerHTML = `
                    <i class="fa-solid fa-thumbtack pin-gold-dot"></i>
                    <span style="font-size:12.5px; font-family:'Courier New', monospace; font-weight:bold; pointer-events:none; white-space:nowrap;">${window.escHtml(apt.name)}</span>
                    <div class="tuev-plakette" style="margin: 0 4px;">${ctx.shortYear}</div>
                    <span style="font-size:9.5px; font-weight:bold; pointer-events:none; white-space:nowrap; line-height:1.15;">${niceDate}<br>${displayTime}</span>
                    <button type="button" class="unpin-plate-btn" onclick="event.stopPropagation(); window.markApt('${id}', false)" title="Von Pinnwand lösen">×</button>
                `;

                if (ctx.savedPositions[id] && ctx.savedPositions[id].top && ctx.savedPositions[id].left) {
                    plate.style.top = ctx.savedPositions[id].top;
                    plate.style.left = ctx.savedPositions[id].left;
                } else {
                    const existingPinsCount = ctx.pinContainer.querySelectorAll('.pinned-plate').length;
                    plate.style.top = Math.max(90, window.innerHeight - 85 - (existingPinsCount * 54)) + 'px';
                    plate.style.left = Math.max(12, window.innerWidth - 260) + 'px';
                }
                ctx.pinContainer.appendChild(plate);
                window.makeDraggable(plate, id);
            }

            return card;
        }

        function renderAppointments(apts) {
            window.redApts = apts;
            if (!window.isAuthorized) return;
            const list = document.getElementById('admin-list');
            if (!list) return;
            list.innerHTML = '';
            const pinContainer = document.getElementById('pinned-container');
            if (pinContainer) pinContainer.innerHTML = '';

            let hasPrio = false;
            let todayCount = 0;
            let plannedCount = 0;
            let expiredCount = 0;
            let laboCount = 0;
            let doneCount = 0;
            let pinnedCount = 0;

            if (apts.length === 0) {
                list.innerHTML = '<p style="font-size:12px; color:var(--text-muted); text-align:center; margin-top:20px;">Keine Termine im System.</p>';
                updateBadgeDisplay(false, 0);
                ['kpiTotalApts','kpiTodayApts','kpiPlannedApts','kpiExpiredApts','kpiLaboApts','kpiDoneApts','kpiPinnedApts'].forEach(k => {
                    if (document.getElementById(k)) document.getElementById(k).innerText = '0';
                });
                return;
            }

            const openApts = [];
            const doneApts = [];

            apts.forEach((apt) => {
                const curStep = Number(apt.orderStatus) || 1;
                const isDone = (curStep === 4);
                const isLabo = (!isDone && (curStep === 2 || curStep === 3));
                const isExpired = isAptExpired(apt.date, apt.timeLabel);
                const isTodayDate = isAptToday(apt.date);

                if (apt.marked) pinnedCount++;
                if (isDone) {
                    doneCount++;
                    doneApts.push(apt);
                } else {
                    openApts.push(apt);
                    if (isLabo) laboCount++;
                    if (isExpired && !isLabo) expiredCount++;
                    else if (isTodayDate) { todayCount++; hasPrio = true; }
                    else plannedCount++;
                }
            });

            // Intelligente Sortierung für offene Vorgänge
            const sortMode = window.adminLeadSortMode || 'priority';
            openApts.sort((a, b) => {
                if (sortMode === 'newest') return (b.timestamp || 0) - (a.timestamp || 0);
                if (sortMode === 'date') return getAptTimestamp(a.date, a.timeLabel) - getAptTimestamp(b.date, b.timeLabel);
                // Dringlichkeit: Gepinnt & Heute zuerst, dann Beim LABO, dann Geplant, dann Zeit vorbei
                const rank = (x) => {
                    if (x.marked) return 0;
                    if (isAptToday(x.date) && !isAptExpired(x.date, x.timeLabel)) return 1;
                    if (Number(x.orderStatus) === 2 || Number(x.orderStatus) === 3) return 2;
                    if (!isAptExpired(x.date, x.timeLabel)) return 3;
                    return 4;
                };
                const rDiff = rank(a) - rank(b);
                if (rDiff !== 0) return rDiff;
                return (b.timestamp || 0) - (a.timestamp || 0);
            });

            doneApts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const ctx = {
                pinContainer,
                savedPositions: JSON.parse(localStorage.getItem('pin_positions') || '{}'),
                shortYear: String(window.getDynamicSystemYear()).slice(-2)
            };

            // 1. BEREICH: OFFENE & AKTIVE AUFTRÄGE
            const openWrap = document.createElement('div');
            openWrap.id = 'adminOpenSectionWrap';
            openWrap.innerHTML = `
                <div class="admin-section-divider">
                    <span><i class="fa-solid fa-fire-flame-curved" style="color:var(--primary-red);"></i> Offene &amp; Aktive Vorgänge</span>
                    <span class="admin-section-count">${openApts.length} offen</span>
                </div>
                <div class="admin-cards-stack" id="adminOpenStack"></div>
                <div id="adminOpenEmptyHint" style="display:none; text-align:center; padding:18px; font-size:12px; color:var(--text-muted); background:var(--bg-input); border-radius:12px; margin-top:6px;">
                    <i class="fa-solid fa-circle-check" style="color:var(--green-accent); font-size:18px; display:block; margin-bottom:5px;"></i>
                    Alle offenen Aufträge in dieser Ansicht sind erledigt!
                </div>
            `;
            list.appendChild(openWrap);

            const openStack = openWrap.querySelector('#adminOpenStack');
            openApts.forEach(apt => openStack.appendChild(buildAdminAppointmentCard(apt, ctx)));

            // 2. BEREICH: EINGEKLAPPTES ARCHIV FÜR ERLEDIGTE AUFTRÄGE
            const archiveEl = document.createElement('details');
            archiveEl.id = 'adminCompletedArchive';
            archiveEl.className = 'admin-archive-details';
            archiveEl.innerHTML = `
                <summary>
                    <span style="display:inline-flex; align-items:center; gap:7px;">
                        <i class="fa-solid fa-box-archive"></i>
                        <span>Erledigte Aufträge (Archiv)</span>
                        <span class="admin-section-count" style="background:var(--bg-card); color:var(--green-accent); border-color:var(--green-border);">${doneApts.length}</span>
                    </span>
                    <span style="display:inline-flex; align-items:center; gap:6px; font-size:10.5px; color:var(--text-muted); font-weight:700;">
                        <span>Im Kunden-CRM gesichert</span>
                        <i class="fa-solid fa-chevron-down archive-chevron"></i>
                    </span>
                </summary>
                <div class="admin-archive-body" id="adminArchiveStack"></div>
            `;
            list.appendChild(archiveEl);

            const archiveStack = archiveEl.querySelector('#adminArchiveStack');
            if (doneApts.length === 0) {
                archiveStack.innerHTML = '<p style="font-size:11.5px; color:var(--text-muted); text-align:center; padding:8px 0;">Noch keine abgeschlossenen Aufträge im Archiv.</p>';
            } else {
                doneApts.forEach(apt => archiveStack.appendChild(buildAdminAppointmentCard(apt, ctx)));
            }

            // KPI-Zähler aktualisieren (erste Kachel zeigt jetzt direkt die offenen Vorgänge)
            if (document.getElementById('kpiTotalApts')) document.getElementById('kpiTotalApts').innerText = openApts.length;
            if (document.getElementById('kpiTodayApts')) document.getElementById('kpiTodayApts').innerText = todayCount;
            if (document.getElementById('kpiPlannedApts')) document.getElementById('kpiPlannedApts').innerText = plannedCount;
            if (document.getElementById('kpiExpiredApts')) document.getElementById('kpiExpiredApts').innerText = expiredCount;
            if (document.getElementById('kpiLaboApts')) document.getElementById('kpiLaboApts').innerText = laboCount;
            if (document.getElementById('kpiDoneApts')) document.getElementById('kpiDoneApts').innerText = doneCount;
            if (document.getElementById('kpiPinnedApts')) document.getElementById('kpiPinnedApts').innerText = pinnedCount;
            if (document.getElementById('kpiTotalCrm')) document.getElementById('kpiTotalCrm').innerText = Object.keys(window.crmClientsDetail || {}).length;

            updateBadgeDisplay(hasPrio, openApts.length);
            window.filterAdminLeads();
        }

        window.refreshAdminAppointmentsView = () => renderAppointments(window.redApts || localAppointments);

        // Automatischer Minuten-Check für "Zeit vorbei" (nur für eingeloggte Admins)
        setInterval(() => {
            if (!window.isAuthorized || !window.redApts || window.redApts.length === 0) return;
            const modalOpen = document.getElementById('adminModal')?.classList.contains('open');
            const hasPins = window.redApts.some(a => a.marked);
            if (modalOpen || hasPins) {
                renderAppointments(window.redApts);
            }
        }, 60000);

        let aptsUnsubscribe = null;
        window.stopAdminAppointmentsListener = function() {
            if (aptsUnsubscribe) { aptsUnsubscribe(); aptsUnsubscribe = null; }
            isFirstLoadApts = true;
            const list = document.getElementById('admin-list');
            if (list) list.innerHTML = '';
            const pinContainer = document.getElementById('pinned-container');
            if (pinContainer) pinContainer.innerHTML = '';
        };

        window.startAdminAppointmentsListener = function() {
            if (!window.isAuthorized || aptsUnsubscribe) return;
            aptsUnsubscribe = onSnapshot(query(collection(db, "appointments"), orderBy("timestamp", "desc")), (snapshot) => {
                const fbApts = [];
                snapshot.forEach((docSnap) => fbApts.push({ id: docSnap.id, ...docSnap.data() }));

                if (!isFirstLoadApts && window.isAuthorized) {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            const newBooking = change.doc.data();
                            window.showToast(`Neue Buchung: ${newBooking.name} (${newBooking.service})`, 'success');
                            document.getElementById('adminKeyBtn').classList.add('new-alert');
                            if (typeof window.playAdminNotificationSound === 'function') {
                                window.playAdminNotificationSound();
                            }
                        }
                    });
                }
                isFirstLoadApts = false;
                localAppointments = fbApts;
                renderAppointments(fbApts);
            }, (err) => {
                console.error('Termine konnten nicht geladen werden:', err);
            });
        };

        window.markApt = async function(id, newState) {
            try { 
                await updateDoc(doc(db, "appointments", id), { marked: newState }); 
                window.showToast(newState ? '📌 Kennzeichen gelb markiert & angeheftet (frei verschiebbar)!' : 'Kennzeichen von Pinnwand gelöst.', 'success');
            } catch(e) { 
                const index = localAppointments.findIndex(a => a.id === id);
                if(index > -1) {
                    localAppointments[index].marked = newState;
                    localStorage.setItem('red_local_apts', JSON.stringify(localAppointments));
                    renderAppointments(localAppointments);
                    window.showToast(newState ? '📌 Lokal gelb markiert & angeheftet!' : 'Abgeheftet.', 'success');
                }
            }
        };
        
        async function releaseBookedSlot(dateStr, timeStr) {
            const normDate = window.normalizeDateDE(dateStr);
            const normTime = String(timeStr || '').replace(' Uhr', '').trim();
            if (!normDate || !normTime || normTime === 'Ganztägig') return;
            const matches = (window.bookedSlotsList || []).filter(s =>
                window.normalizeDateDE(s.date) === normDate &&
                String(s.time || '').replace(' Uhr', '').trim() === normTime
            );
            for (const slot of matches) {
                try { await deleteDoc(doc(db, "booked_slots", slot.id)); } catch (e) {}
            }
        }

        window.openEditAptModal = function(id) {
            window.editingAptId = id;
            const apt = window.redApts.find(a => a.id === id);
            if(!apt) return;
            
            const niceDate = window.normalizeDateDE(apt.date);
            document.getElementById('editAptDate').value = niceDate;
            try { document.getElementById('editAptDate')._flatpickr.setDate(niceDate, true); } catch(e){}
            
            const timeSelect = document.getElementById('editAptTime');
            timeSelect.value = (apt.timeLabel || '').includes('Uhr') ? apt.timeLabel : (apt.timeLabel || '') + ' Uhr';
            if(timeSelect.selectedIndex === -1) timeSelect.value = 'Ganztägig';

            document.getElementById('editAptOverlay').classList.add('open');
        };

        window.closeEditAptModal = function() {
            window.editingAptId = null;
            document.getElementById('editAptOverlay').classList.remove('open');
        };

        window.saveEditedApt = async function() {
            if(!window.editingAptId) return;
            const newDate = window.normalizeDateDE(document.getElementById('editAptDate').value);
            const newTime = document.getElementById('editAptTime').value;
            const oldApt = (window.redApts || localAppointments || []).find(a => a.id === window.editingAptId);

            try {
                await updateDoc(doc(db, "appointments", window.editingAptId), { date: newDate, timeLabel: newTime });

                if (oldApt) {
                    await releaseBookedSlot(oldApt.date, oldApt.timeLabel);
                }
                if (newDate && newTime && newTime !== 'Ganztägig') {
                    await addDoc(collection(db, "booked_slots"), {
                        date: newDate,
                        time: newTime,
                        timestamp: Date.now()
                    }).catch(() => {});
                }

                const resolvedCode = oldApt?.trackingCode || ((oldApt?.notes || []).map(nt => (String(nt.text || '').match(/RED-\d{6}/) || [])[0]).find(Boolean)) || '';
                if (resolvedCode) {
                    await setDoc(doc(db, "order_tracking", resolvedCode), {
                        date: newDate,
                        timeLabel: newTime,
                        updatedAt: Date.now()
                    }, { merge: true }).catch(() => {});
                }

                window.showToast('Termin verschoben & Zeitslot aktualisiert!', 'success');
            } catch(e) {
                const index = localAppointments.findIndex(a => a.id === window.editingAptId);
                if(index > -1) {
                    localAppointments[index].date = newDate;
                    localAppointments[index].timeLabel = newTime;
                    localStorage.setItem('red_local_apts', JSON.stringify(localAppointments));
                    renderAppointments(localAppointments);
                    window.showToast('Lokal verschoben.', 'success');
                }
            }
            window.closeEditAptModal();
        };

        window.editAptNotes = function(id) {
            window.editingNoteElement = null; 
            window.editingNoteId = null;
            const input = document.getElementById(`note-input-${id}`);
            input.value = '';
            input.classList.toggle('active');
            if(input.classList.contains('active')) input.focus();
        };
        
        window.saveNote = async function(e, inputEl, aptId) {
            if(e.key === 'Enter') {
                e.preventDefault();
                const noteText = inputEl.value.trim();
                if(noteText === '') return;
                
                inputEl.classList.remove('active');
                const timestamp = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                const currentList = window.redApts && window.redApts.length ? window.redApts : localAppointments;
                const index = currentList.findIndex(a => a.id === aptId);
                if(index > -1) {
                    if(!currentList[index].notes) currentList[index].notes = [];
                    
                    if(window.editingNoteElement) {
                        const nIndex = currentList[index].notes.findIndex(n => n.id === window.editingNoteElement.id.replace('note-',''));
                        if(nIndex > -1) currentList[index].notes[nIndex].text = noteText;
                        window.editingNoteElement = null;
                    } else {
                        currentList[index].notes.push({ id: Date.now().toString(), text: noteText, timeStr: `Erstellt: ${timestamp}` });
                    }
                    localAppointments = currentList;
                    localStorage.setItem('red_local_apts', JSON.stringify(localAppointments));
                    
                    try { await updateDoc(doc(db, "appointments", aptId), { notes: currentList[index].notes }); } catch(err){}
                    
                    renderAppointments(localAppointments);
                    window.showToast('Notiz gespeichert.', 'success');
                }
                inputEl.value = '';
            }
        };

        window.triggerEditNote = function(noteDOMId, cardId) {
            const noteRow = document.getElementById(noteDOMId);
            if(!noteRow) return;
            const text = noteRow.querySelector('.note-text-body').innerText;
            const input = document.getElementById(`note-input-${cardId}`);
            
            window.editingNoteElement = noteRow;
            input.value = text;
            input.classList.add('active');
            input.focus();
        };

        window.triggerDeleteNote = function(noteDOMId, aptId) {
            window.deleteNoteTargetId = noteDOMId;
            const confirmEl = document.getElementById('deleteConfirmOverlay');
            confirmEl.querySelector('h3').innerText = "Notiz löschen?";
            confirmEl.querySelector('p').innerText = "Möchten Sie diese Notiz dauerhaft entfernen?";
            confirmEl.classList.add('open');
            window.deleteTargetId = aptId; 
        };

        window.deleteApt = function(id) {
            window.deleteTargetId = id;
            const confirmEl = document.getElementById('deleteConfirmOverlay');
            confirmEl.querySelector('h3').innerText = "Eintrag löschen?";
            confirmEl.querySelector('p').innerText = "Möchten Sie diesen Kundentermin wirklich unwiderruflich aus dem System entfernen?";
            confirmEl.classList.add('open');
        };

        window.cancelDelete = function() {
            const ov = document.getElementById('deleteConfirmOverlay');
            if (ov) { ov.classList.remove('open'); ov.style.zIndex = ''; }
            window.deleteTargetId = null;
            window.deleteNoteTargetId = null;
            window._customConfirmCallback = null;
        };

        window.confirmDelete = async function() {
            if (typeof window._customConfirmCallback === 'function') {
                const cb = window._customConfirmCallback;
                window.cancelDelete();
                await cb();
                return;
            }
            if(window.deleteNoteTargetId) {
                const currentList = window.redApts && window.redApts.length ? window.redApts : localAppointments;
                const index = currentList.findIndex(a => a.id === window.deleteTargetId);
                if(index > -1) {
                    currentList[index].notes = currentList[index].notes.filter(n => n.id !== window.deleteNoteTargetId.replace('note-',''));
                    localAppointments = currentList;
                    localStorage.setItem('red_local_apts', JSON.stringify(localAppointments));
                    try { await updateDoc(doc(db, "appointments", window.deleteTargetId), { notes: currentList[index].notes }); } catch(err){}
                    renderAppointments(localAppointments);
                }
                window.showToast('Notiz gelöscht.', 'success');
            }
            else if(window.deleteTargetId) {
                const targetApt = (window.redApts || localAppointments || []).find(a => a.id === window.deleteTargetId);
                const cardElement = document.getElementById(window.deleteTargetId);
                const pinnedElement = document.getElementById('pinned-' + window.deleteTargetId);
                if(cardElement) cardElement.remove();
                if(pinnedElement) pinnedElement.remove();

                try {
                    await deleteDoc(doc(db, "appointments", window.deleteTargetId));

                    if (targetApt) {
                        await releaseBookedSlot(targetApt.date, targetApt.timeLabel);
                        const resolvedCode = targetApt.trackingCode || ((targetApt.notes || []).map(nt => (String(nt.text || '').match(/RED-\d{6}/) || [])[0]).find(Boolean)) || '';
                        if (resolvedCode) {
                            await deleteDoc(doc(db, "order_tracking", resolvedCode)).catch(() => {});
                        }
                    }
                    
                    let positions = JSON.parse(localStorage.getItem('pin_positions') || '{}');
                    if(positions[window.deleteTargetId]) {
                        delete positions[window.deleteTargetId];
                        localStorage.setItem('pin_positions', JSON.stringify(positions));
                    }
                    window.showToast('Termin gelöscht & Zeitfenster wieder freigegeben.', 'success');
                } catch(e) {
                    window.showToast('Lokal gelöscht.', 'success');
                }
                
                localAppointments = localAppointments.filter(a => a.id !== window.deleteTargetId);
                localStorage.setItem('red_local_apts', JSON.stringify(localAppointments));
            }
            window.cancelDelete();
        };

        async function addClientToCRM(name, phone, email, category, customNote) {
            if (!window.isAuthorized) {
                // Kollisionsfreie ID für öffentliche Buchungen, ohne andere Kundendaten zu laden oder zu überschreiben
                const uniqueDigits = String(Date.now()).slice(-9);
                const newId = 'RED-' + uniqueDigits.replace(/(\d{3})(?=\d)/g, '$1 ');
                const newClient = {
                    clientId: newId,
                    category: category || 'Privatkunde',
                    name: name,
                    phone: phone,
                    email: email,
                    birthday: '',
                    address: '',
                    city: '',
                    notes: customNote || '',
                    bookings: 1,
                    timestamp: Date.now()
                };
                try {
                    await setDoc(doc(db, "settings", "crm_details"), { details: { [newId]: newClient } }, { merge: true });
                } catch(e) {}
                return;
            }

            let existingClientId = null;
            let maxIdNumber = 0;
            for (let key in window.crmClientsDetail) {
                let client = window.crmClientsDetail[key];
                if (client.clientId && client.clientId.startsWith('RED-')) {
                    let numVal = parseInt(client.clientId.replace(/\D/g, ''), 10);
                    if (!isNaN(numVal) && numVal < 1000000 && numVal > maxIdNumber) maxIdNumber = numVal;
                }
                if ((email && client.email === email) || (phone && client.phone === phone) || (name && client.name && client.name.toLowerCase() === name.toLowerCase())) {
                    existingClientId = key;
                }
            }

            let targetId = existingClientId;
            if (existingClientId) {
                window.crmClientsDetail[existingClientId].bookings = (window.crmClientsDetail[existingClientId].bookings || 1) + 1;
                if (category) window.crmClientsDetail[existingClientId].category = category;
                if (customNote) {
                    const prev = window.crmClientsDetail[existingClientId].notes || '';
                    window.crmClientsDetail[existingClientId].notes = prev ? `${prev} | ${customNote}` : customNote;
                }
                window.crmClientsDetail[existingClientId].timestamp = Date.now();
            } else {
                maxIdNumber++;
                targetId = 'RED-' + maxIdNumber.toString().padStart(9, '0').replace(/(\d{3})(?=\d)/g, '$1 ');
                window.crmClientsDetail[targetId] = {
                    clientId: targetId,
                    category: category || 'Privatkunde',
                    name: name, phone: phone, email: email,
                    birthday: '', address: '', city: '',
                    notes: customNote || '', bookings: 1, timestamp: Date.now()
                };
            }

            try {
                await setDoc(doc(db, "settings", "crm_details"), { details: { [targetId]: window.crmClientsDetail[targetId] } }, { merge: true });
            } catch(e) {}
            if(document.getElementById('kpiTotalCrm')) {
                document.getElementById('kpiTotalCrm').innerText = Object.keys(window.crmClientsDetail).length;
            }
            if(document.getElementById('crmOverlay').classList.contains('open')) window.renderCRM();
        }

        // --- BUCHUNGS-LOGIK MIT WUNSCHKENNZEICHEN, KUNDENART & E-MAIL-WEBHOOK ---
        window.executeBooking = async function(event) {
            event.preventDefault();
            const n = document.getElementById('formName').value.trim();
            const p = document.getElementById('formPhone').value.trim();
            const e = document.getElementById('formEmail').value.trim();
            const d = document.getElementById('datePicker').value;
            const wunschkennzeichen = document.getElementById('formWunschkennzeichen')?.value.trim().toUpperCase() || '';
            const customNote = document.getElementById('formCustomNote')?.value.trim() || '';
            const category = window.selectedClientCategory || 'Privatkunde';
            const btn = document.getElementById('submitBtn');

            btn.innerText = 'Sende...';
            btn.disabled = true;

            const crmNoteCombined = [
                wunschkennzeichen ? `Wunschkennzeichen: ${wunschkennzeichen}` : '',
                customNote
            ].filter(Boolean).join(' | ');

            if (window.isAuthorized) {
                await addClientToCRM(n, p, e, category, crmNoteCombined);
            }

            let timeString = window.chosenHour ? window.chosenHour : "Ganztägig";
            if (!timeString.includes("Uhr")) timeString += " Uhr";

            const trackingCode = typeof window.getOrCreatePendingTrackingCode === 'function'
                ? window.getOrCreatePendingTrackingCode(false)
                : ('RED-' + Math.floor(100000 + Math.random() * 900000));

            window.lastBookedApt = {
                name: n, phone: p, email: e, date: d, time: timeString,
                service: window.selectedServiceVal, category, wunschkennzeichen, customNote, trackingCode
            };

            const initialNotes = [
                { id: String(Date.now()), text: `📡 Live-Tracker-Code: ${trackingCode}`, timeStr: 'Automatisch vergeben' }
            ];
            if (wunschkennzeichen) {
                initialNotes.push({ id: String(Date.now() + 1), text: `🪪 Wunschkennzeichen: ${wunschkennzeichen}`, timeStr: 'Bei Buchung gewählt' });
            }
            if (customNote) {
                initialNotes.push({ id: String(Date.now() + 2), text: `Kunden-Hinweis: ${customNote}`, timeStr: 'Bei Buchung angegeben' });
            }

            const appointmentData = {
                name: n, phone: p, email: e, date: d, timeLabel: timeString,
                service: window.selectedServiceVal, category,
                wunschkennzeichen, customNote, trackingCode,
                marked: false, orderStatus: 1, notes: initialNotes, timestamp: Date.now()
            };

            const trackingPayload = {
                code: trackingCode,
                date: d,
                timeLabel: timeString,
                service: window.selectedServiceVal,
                wunschkennzeichen: wunschkennzeichen || '',
                orderStatus: 1,
                timestamp: Date.now()
            };

            try {
                await addDoc(collection(db, "appointments"), appointmentData);
            } catch(err) {
                console.error("Buchungs-Fehler:", err);
                window.showToast('Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.', 'error');
                btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Termin jetzt verbindlich reservieren';
                btn.disabled = false;
                return;
            }

            // Zeitfenster & Live-Tracker getrennt speichern, damit das Warn-Popup garantiert öffnet
            addDoc(collection(db, "booked_slots"), { date: d, time: timeString, timestamp: Date.now() }).catch(() => {});
            setDoc(doc(db, "order_tracking", trackingCode), trackingPayload).catch((err) => {
                console.error("Order-Tracking Schreibfehler:", err);
            });
            try {
                const localMap = JSON.parse(localStorage.getItem('red_local_tracking_map') || '{}');
                localMap[trackingCode] = trackingPayload;
                localStorage.setItem('red_local_tracking_map', JSON.stringify(localMap));
            } catch (err) {}

            // Bestätigungs-Popup mit Auftrags-Code & Warnhinweis SOFORT öffnen
            const plateInfo = wunschkennzeichen ? ` | Wunschkennzeichen: ${wunschkennzeichen}` : '';
            const titleEl = document.getElementById('confirmModalTitle');
            if (titleEl) titleEl.innerText = 'Termin Reserviert!';
            document.getElementById('confirmModalText').innerHTML = `Vielen Dank, <strong>${window.escHtml(n)}</strong>! Ihr Termin (${window.escHtml(category)}) am <strong>${window.escHtml(d)}</strong> um <strong>${window.escHtml(timeString)}</strong> für „${window.escHtml(window.selectedServiceVal)}“${window.escHtml(plateInfo)} wurde verbindlich eingetragen.`;
            const codeValEl = document.getElementById('confirmTrackingCodeVal');
            if (codeValEl) codeValEl.innerText = trackingCode;
            document.getElementById('confirmModalOverlay').classList.add('open');
            window.showToast(`WICHTIG: Ihr Auftrags-Code lautet ${trackingCode} – bitte notieren!`, 'success');

            // Benachrichtigung im Hintergrund senden
            window.sendToMakeWebhook({
                type: 'new_booking',
                trackingCode: trackingCode,
                clientName: n,
                clientCategory: category,
                clientPhone: p || '-',
                clientEmail: e,
                date: d,
                time: timeString,
                service: window.selectedServiceVal,
                wunschkennzeichen: wunschkennzeichen || 'Kein Wunschkennzeichen angegeben',
                customNote: customNote || '-'
            }).catch(() => {});
            try { sessionStorage.removeItem('red_pending_plate'); } catch (err) {}
            
            document.getElementById('bookingForm').reset();
            document.getElementById('timeWrapper').style.display = 'none';
            btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Termin jetzt verbindlich reservieren';
            btn.disabled = true;
            window.chosenHour = null;
            if (typeof window.getOrCreatePendingTrackingCode === 'function') {
                window.getOrCreatePendingTrackingCode(true);
            }
            window.updateBookingLiveSummary();
        };
        
        // =========================================================================
        // FORMULAR-VERWALTUNG (FLEXIBEL +/- ERWEITERBAR & LEER BIS ZUM EIGENEN UPLOAD)
        // =========================================================================
        const staticForms = [
            {id: 'static-1', title: 'Allgemeine Vollmacht', url: ''}, 
            {id: 'static-2', title: 'Antrag auf Ausnahmegenehmigung', url: ''},
            {id: 'static-3', title: 'Antrag auf Kurzzeitkennzeichen', url: ''}, 
            {id: 'static-4', title: 'Antrag auf Steuervergünstigung', url: ''},
            {id: 'static-5', title: 'Empfangsbevollmächtigung', url: ''}, 
            {id: 'static-6', title: 'Eidesstattliche Versicherung (EV I)', url: ''},
            {id: 'static-7', title: 'Eidesstattliche Versicherung (EV II)', url: ''}, 
            {id: 'static-8', title: 'EV (Schilder)', url: ''},
            {id: 'static-9', title: 'Kennzeichenreservierung', url: ''}, 
            {id: 'static-10', title: 'Mitteilung für Umsatzsteuerzwecke', url: ''},
            {id: 'static-11', title: 'SEPA-Lastschriftmandat', url: ''}, 
            {id: 'static-12', title: 'Zulassungsantrag', url: ''}
        ];

        function hasValidUploadedFile(url) {
            if (!url || typeof url !== 'string') return false;
            const trimmed = url.trim();
            if (trimmed === '' || trimmed === '#' || trimmed.startsWith('internal:')) return false;
            return true;
        }

        window.allFormsMap = {};
        staticForms.forEach(f => { window.allFormsMap[f.id] = { ...f }; });

        let localForms = JSON.parse(localStorage.getItem('red_forms_clean_v2'));
        if(localForms && Array.isArray(localForms)) {
            localForms.forEach(f => {
                if (f && f.id) {
                    const cleanUrl = hasValidUploadedFile(f.url) ? f.url : '';
                    window.allFormsMap[f.id] = { ...f, url: cleanUrl };
                }
            });
        }

        function getActiveFormsList() {
            return Object.values(window.allFormsMap).filter(f => !f.deleted);
        }

        window.filterFormItems = function() {
            const q = (document.getElementById('formsSearchInput')?.value || '').trim().toLowerCase();
            const items = document.querySelectorAll('#formItemsGrid .download-item');
            let visible = 0;
            items.forEach(item => {
                const title = (item.querySelector('.form-doc-title')?.innerText || '').toLowerCase();
                const match = !q || title.includes(q);
                item.style.display = match ? 'flex' : 'none';
                if (match) visible++;
            });
            const countEl = document.getElementById('formsCountNum');
            if (countEl) countEl.innerText = String(visible);
        };

        function renderFormsList(formsList) {
            const grid = document.getElementById('formItemsGrid');
            if(!grid) return;
            grid.innerHTML = '';

            formsList.forEach(form => {
                const element = document.createElement('div');
                element.className = 'download-item';
                element.id = form.id;
                const cleanUrl = hasValidUploadedFile(form.url) ? form.url : '';
                element.setAttribute('data-url', cleanUrl);
                
                const statusBadge = cleanUrl !== ''
                    ? `<span class="form-status-pill is-ready"><i class="fa-solid fa-circle-check"></i> PDF bereit zum Download</span>`
                    : `<span class="form-status-pill is-empty"><i class="fa-regular fa-clock"></i> In Vorbereitung</span>`;

                element.innerHTML = `
                    <div class="download-info" onclick="window.openFormFromCard('${form.id}')">
                        <div class="form-doc-icon-box" style="opacity:${cleanUrl !== '' ? '1' : '0.45'};">
                            <i class="fa-solid fa-file-pdf"></i>
                        </div>
                        <div class="form-doc-meta">
                            <span class="form-doc-title" title="${window.escHtml(form.title)}">${window.escHtml(form.title)}</span>
                            ${statusBadge}
                        </div>
                    </div>
                    <div class="download-actions">
                        <div class="form-admin-btn-group">
                            <i class="fa-solid fa-pen action-forms" title="Mit Stift bearbeiten / Datei hochladen" onclick="event.stopPropagation(); window.openFormEditModal('${form.id}')"></i>
                            <i class="fa-solid fa-link action-forms" title="Direkt-Link hinterlegen" onclick="event.stopPropagation(); window.triggerAdminLinkUpdate(this, '${form.id}')"></i>
                            <i class="fa-solid fa-upload action-forms" title="PDF/Datei vom Gerät hochladen" onclick="event.stopPropagation(); window.triggerAdminUpload(this, '${form.id}')"></i>
                            <i class="fa-solid fa-trash-can action-forms" title="Formular entfernen" onclick="event.stopPropagation(); window.adminDeleteForm('${form.id}')"></i>
                        </div>
                        <div class="form-user-btn-group">
                            <button type="button" class="form-user-btn user-view" title="Dokument ansehen" onclick="event.stopPropagation(); window.openForm(this)"><i class="fa-solid fa-eye"></i> Ansehen</button>
                            <button type="button" class="form-user-btn user-dl" title="Dokument herunterladen" onclick="event.stopPropagation(); window.downloadForm(this)"><i class="fa-solid fa-download"></i> PDF</button>
                        </div>
                    </div>
                `;
                grid.appendChild(element);
            });

            window.filterFormItems();
        }

        let formsListenerStarted = false;
        window.ensureFormsLoaded = function() {
            if (formsListenerStarted) return;
            formsListenerStarted = true;
            renderFormsList(getActiveFormsList());
            onSnapshot(collection(db, "forms"), (snapshot) => {
                staticForms.forEach(f => {
                    if(!window.allFormsMap[f.id]) window.allFormsMap[f.id] = { ...f };
                });
                if(!snapshot.empty) {
                    snapshot.forEach(docSnap => {
                        const d = docSnap.data();
                        let validUrl = '';
                        if (d.url && d.url.startsWith('data:')) {
                            validUrl = d.url;
                        } else if (d.customUploaded && hasValidUploadedFile(d.url)) {
                            validUrl = d.url;
                        }
                        window.allFormsMap[docSnap.id] = {
                            id: docSnap.id,
                            title: d.title || (window.allFormsMap[docSnap.id]?.title || 'Formular'),
                            url: validUrl,
                            customUploaded: !!d.customUploaded,
                            deleted: !!d.deleted
                        };
                    });
                }
                const activeList = getActiveFormsList();
                localStorage.setItem('red_forms_clean_v2', JSON.stringify(activeList));
                renderFormsList(activeList);
            }, () => {
                renderFormsList(getActiveFormsList());
            });
        };
        if (window.location.hash === '#view-formulare') window.ensureFormsLoaded();

        window.restoreDefaultFormsList = async function() {
            for (const f of staticForms) {
                const existing = window.allFormsMap[f.id] || {};
                const restored = {
                    id: f.id,
                    title: existing.title || f.title,
                    url: (existing.customUploaded && hasValidUploadedFile(existing.url)) ? existing.url : '',
                    customUploaded: !!existing.customUploaded,
                    deleted: false
                };
                window.allFormsMap[f.id] = restored;
                try {
                    await setDoc(doc(db, "forms", f.id), restored, { merge: true });
                } catch(e){}
            }
            localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
            renderFormsList(getActiveFormsList());
            window.showToast('Alle Standard-Anträge wurden wiederhergestellt!', 'success');
        };

        window.addNewFormItem = async function() {
            const title = document.getElementById('newFormTitle').value.trim();
            const urlInput = document.getElementById('newFormUrl').value.trim();
            const fileInput = document.getElementById('newFormFile');
            
            if(!title) { window.showToast('Bitte einen Formular-Titel eingeben.', 'error'); return; }

            const saveFormRecord = async (finalUrl) => {
                const newId = 'form-' + Date.now();
                const hasFile = hasValidUploadedFile(finalUrl);
                const formData = { id: newId, title, url: hasFile ? finalUrl : '', customUploaded: hasFile, deleted: false, timestamp: Date.now() };
                window.allFormsMap[newId] = formData;
                localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
                renderFormsList(getActiveFormsList());

                try {
                    await setDoc(doc(db, "forms", newId), formData);
                    window.showToast('Formular erfolgreich zur Liste hinzugefügt!', 'success');
                } catch(e) {
                    window.showToast('Formular lokal gespeichert.', 'success');
                }

                document.getElementById('newFormTitle').value = '';
                document.getElementById('newFormUrl').value = '';
                if(fileInput) fileInput.value = '';
                document.getElementById('newFormFileLabel').innerHTML = `<i class="fa-solid fa-file-arrow-up"></i> PDF/Datei vom Gerät wählen`;
            };

            if(fileInput && fileInput.files && fileInput.files[0]) {
                if (fileInput.files[0].size > 700 * 1024) {
                    window.showToast('Datei ist größer als 700 KB. Bitte vorher komprimieren oder als Link einfügen.', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(ev) { saveFormRecord(ev.target.result); };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                saveFormRecord(urlInput);
            }
        };

        window.openFormEditModal = function(formId) {
            const form = window.allFormsMap[formId] || { id: formId, title: '', url: '' };
            document.getElementById('editFormIdInput').value = formId;
            document.getElementById('editFormTitleInput').value = form.title || '';
            document.getElementById('editFormUrlInput').value = (form.url && !form.url.startsWith('data:')) ? form.url : '';
            document.getElementById('editFormFileInput').value = '';
            document.getElementById('editFormFileLabel').innerHTML = (form.url && form.url.startsWith('data:'))
                ? `<i class="fa-solid fa-check" style="color:#25D366;"></i> Eigene Datei hinterlegt (Neu wählen zum Ersetzen)`
                : `<i class="fa-solid fa-cloud-arrow-up"></i> PDF / Datei auswählen`;
            document.getElementById('formEditModalOverlay').classList.add('open');
        };

        window.closeFormEditModal = function() {
            document.getElementById('formEditModalOverlay').classList.remove('open');
        };

        window.clearFormFileInModal = async function() {
            const formId = document.getElementById('editFormIdInput').value;
            if(!formId || !window.allFormsMap[formId]) return;
            window.allFormsMap[formId].url = '';
            window.allFormsMap[formId].customUploaded = false;
            localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
            renderFormsList(getActiveFormsList());
            try {
                await setDoc(doc(db, "forms", formId), window.allFormsMap[formId], { merge: true });
            } catch(e){}
            window.showToast('Inhalt geleert – Karte ist wieder ohne Datei.', 'success');
            window.closeFormEditModal();
        };

        window.saveFormEditModal = async function() {
            const formId = document.getElementById('editFormIdInput').value;
            const newTitle = document.getElementById('editFormTitleInput').value.trim();
            const newUrlInput = document.getElementById('editFormUrlInput').value.trim();
            const fileInput = document.getElementById('editFormFileInput');

            if(!newTitle) { window.showToast('Bitte einen Titel eingeben.', 'error'); return; }

            const existing = window.allFormsMap[formId] || {};

            const persistUpdate = async (finalUrl) => {
                const hasFile = hasValidUploadedFile(finalUrl);
                const updatedData = { id: formId, title: newTitle, url: hasFile ? finalUrl : '', customUploaded: hasFile, deleted: false, timestamp: Date.now() };
                window.allFormsMap[formId] = updatedData;
                localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
                renderFormsList(getActiveFormsList());

                try {
                    await setDoc(doc(db, "forms", formId), updatedData, { merge: true });
                    window.showToast('Formular erfolgreich gespeichert!', 'success');
                } catch(e) {
                    window.showToast('Formular lokal gespeichert.', 'success');
                }
                window.closeFormEditModal();
            };

            if(fileInput && fileInput.files && fileInput.files[0]) {
                if (fileInput.files[0].size > 700 * 1024) {
                    window.showToast('Datei ist größer als 700 KB. Bitte vorher komprimieren oder als Link einfügen.', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(ev) { persistUpdate(ev.target.result); };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                const finalUrl = newUrlInput !== '' ? newUrlInput : (existing.url && existing.url.startsWith('data:') ? existing.url : '');
                persistUpdate(finalUrl);
            }
        };

        window.triggerAdminUpload = function(iconEl, formId) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf,.doc,.docx,application/pdf';
            fileInput.onchange = async e => {
                if(e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.size > 700 * 1024) {
                        window.showToast('Datei ist größer als 700 KB. Bitte vorher komprimieren oder als Link einfügen.', 'error');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = async function(ev) {
                        const existing = window.allFormsMap[formId] || { id: formId, title: file.name };
                        const updated = { ...existing, url: ev.target.result, customUploaded: true, deleted: false, timestamp: Date.now() };
                        window.allFormsMap[formId] = updated;
                        localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
                        renderFormsList(getActiveFormsList());

                        try {
                            await setDoc(doc(db, "forms", formId), updated, { merge: true });
                            window.showToast(`Datei für "${existing.title}" erfolgreich hochgeladen!`, 'success');
                        } catch(err) {
                            window.showToast('Datei lokal gespeichert.', 'success');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
            fileInput.click();
        };

        window.triggerAdminLinkUpdate = async function(iconEl, formId) {
            const existing = window.allFormsMap[formId] || { id: formId, title: 'Formular', url: '' };
            const currentLink = (existing.url && !existing.url.startsWith('data:')) ? existing.url : '';
            const newUrl = prompt(`Direkt-Link für "${existing.title}" eingeben (oder leer lassen, um die Verknüpfung zu leeren):`, currentLink);
            
            if (newUrl !== null) {
                const clean = newUrl.trim();
                const updated = { ...existing, url: clean, customUploaded: clean !== '', deleted: false, timestamp: Date.now() };
                window.allFormsMap[formId] = updated;
                localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
                renderFormsList(getActiveFormsList());

                try {
                    await setDoc(doc(db, "forms", formId), updated, { merge: true });
                    window.showToast(clean ? 'Link gespeichert!' : 'Formular-Inhalt geleert.', 'success');
                } catch (e) {
                    window.showToast('Lokal aktualisiert.', 'success');
                }
            }
        };
        
        window.adminDeleteForm = function(formId) {
            window.openRedDeleteConfirm(
                'Formular entfernen?',
                'Möchten Sie dieses Formular aus der Formular-Übersicht entfernen?',
                async () => {
                    if(window.allFormsMap[formId]) {
                        window.allFormsMap[formId].deleted = true;
                    }
                    localStorage.setItem('red_forms_clean_v2', JSON.stringify(getActiveFormsList()));
                    renderFormsList(getActiveFormsList());

                    try {
                        await setDoc(doc(db, "forms", formId), { deleted: true }, { merge: true });
                        window.showToast('Formular entfernt.', 'success');
                    } catch(e) {
                        window.showToast('Lokal entfernt.', 'success');
                    }
                }
            );
        };

        function dataURItoBlob(dataURI) {
            const splitData = dataURI.split(',');
            const byteString = atob(splitData[1]);
            
            let mimeString = splitData[0].split(':')[1].split(';')[0];
            if (!mimeString || mimeString === '' || mimeString.includes('octet-stream')) {
                mimeString = 'application/pdf';
            }
            
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            return new Blob([ab], {type: mimeString});
        }

        function openExternalTarget(targetUrl) {
            const a = document.createElement('a');
            a.href = targetUrl;
            a.target = '_blank';
            a.rel = 'noreferrer noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        window.openFormFromCard = function(formId) {
            const item = document.getElementById(formId);
            if(!item) return;
            const eyeIcon = item.querySelector('.user-view');
            if(eyeIcon) window.openForm(eyeIcon);
        };

        window.openForm = function(iconEl) {
            const item = iconEl.closest('.download-item');
            const url = item.getAttribute('data-url');
            
            if (!hasValidUploadedFile(url)) {
                window.showToast('Für diesen Antrag ist aktuell noch keine Datei hinterlegt.', 'error');
                return;
            }

            try {
                if (url.startsWith('data:')) {
                    const blob = dataURItoBlob(url);
                    const viewUrl = URL.createObjectURL(blob);
                    openExternalTarget(viewUrl);
                } else {
                    openExternalTarget(url);
                }
                window.showToast('Dokument geöffnet.', 'success');
            } catch (error) {
                window.showToast('Dokument konnte nicht geöffnet werden.', 'error');
            }
        };

        window.downloadForm = function(iconEl) { 
            const item = iconEl.closest('.download-item');
            const url = item.getAttribute('data-url');
            const title = item.querySelector('span')?.innerText || 'RED_Formular';
            
            if (!hasValidUploadedFile(url)) {
                window.showToast('Für diesen Antrag ist aktuell noch keine Datei zum Herunterladen hinterlegt.', 'error');
                return;
            }

            try {
                if (url.startsWith('data:')) {
                    const blob = dataURItoBlob(url);
                    const downloadBlob = new Blob([blob], {type: "application/octet-stream"});
                    const downloadUrl = URL.createObjectURL(downloadBlob);
                    let extension = (url.includes('msword') || url.includes('wordprocessingml')) ? '.docx' : '.pdf';

                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    a.download = title.replace(/[^a-z0-9äöüß]/gi, '_').toLowerCase() + extension; 
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(downloadUrl);
                    }, 150);
                    window.showToast('Download gestartet!', 'success');
                } else {
                    openExternalTarget(url);
                    window.showToast('Dokument geöffnet.', 'success');
                }
            } catch (error) {
                window.showToast('Download nicht möglich.', 'error');
            }
        };

        // =========================================================================
        // DSGVO-KONFORME FAHRZEUG-GALERIE
        // =========================================================================
        function createSafeCarSvg(label, accentColor) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
                <defs>
                    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#0a0a0f"/>
                        <stop offset="100%" stop-color="#1b1b24"/>
                    </linearGradient>
                </defs>
                <rect width="800" height="500" fill="url(#bg)"/>
                <circle cx="400" cy="250" r="210" fill="${accentColor}" opacity="0.08"/>
                <path d="M625 275 C595 250 520 220 465 202 C405 182 332 168 255 167 C180 166 135 178 112 191 C78 210 50 238 28 270 C16 283 8 296 15 306 C20 314 34 320 51 326 C95 330 130 295 165 295 C200 295 225 330 250 332 C310 336 365 338 415 338 C445 310 475 305 510 335 C565 332 605 320 620 308 C632 298 635 285 625 275 Z" fill="${accentColor}" opacity="0.85" transform="translate(80, -20)"/>
                <text x="400" y="425" font-family="Montserrat, Arial, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="3">${label}</text>
            </svg>`;
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        }

        const staticCarsGallery = [
            {id: 'car-static-1', title: 'Sportwagen & Coupés', mediaUrl: createSafeCarSvg('SPORTWAGEN & COUPÉS', '#e60000')},
            {id: 'car-static-2', title: 'Klassiker & Oldtimer', mediaUrl: createSafeCarSvg('OLDTIMER & KLASSIKER', '#b38728')},
            {id: 'car-static-3', title: 'Limousinen & SUV', mediaUrl: createSafeCarSvg('LIMOUSINEN & SUV', '#007aff')},
            {id: 'car-static-4', title: 'Stadt- & Firmenwagen', mediaUrl: createSafeCarSvg('PKW & FIRMENWAGEN', '#25D366')}
        ];

        let localCarsGallery = JSON.parse(localStorage.getItem('red_local_cars_gallery_v2'));
        if(!localCarsGallery || localCarsGallery.length === 0) {
            localCarsGallery = staticCarsGallery;
            localStorage.setItem('red_local_cars_gallery_v2', JSON.stringify(localCarsGallery));
        }

        function renderGalleryList(carsList) {
            const grid = document.getElementById('carsGalleryGrid');
            if(!grid) return;
            grid.innerHTML = '';
            carsList.forEach(car => {
                const card = document.createElement('div');
                card.className = 'gallery-card';
                card.id = car.id;
                card.addEventListener('click', () => window.openLightbox(car.title || '', car.mediaUrl || ''));
                
                const isVideo = (car.mediaUrl.includes('video/') || car.mediaUrl.endsWith('.mp4') || car.mediaUrl.startsWith('blob:') || car.mediaUrl.includes('firebasestorage'))
                    && !(car.mediaUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|svg)/) || car.mediaUrl.includes('alt='));

                const mediaHtml = isVideo
                    ? `<video src="${car.mediaUrl}" playsinline muted style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; opacity:0.6; z-index:1;"></video>`
                    : `<img src="${car.mediaUrl}" loading="lazy" decoding="async" alt="${window.escHtml(car.title)}">`;
                
                card.innerHTML = `
                    <div class="admin-del-img-btn action-cars" title="Bild Löschen"><i class="fa-solid fa-trash-can"></i></div>
                    ${mediaHtml}
                    <span>${window.escHtml(car.title)}</span>
                `;
                const delBtn = card.querySelector('.admin-del-img-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.deleteGalleryImage(car.id);
                    });
                }
                grid.appendChild(card);
            });
        }

        let carsListenerStarted = false;
        window.ensureCarsLoaded = function() {
            if (carsListenerStarted) return;
            carsListenerStarted = true;
            renderGalleryList(localCarsGallery);
            onSnapshot(collection(db, "cars"), (snapshot) => {
                if(!snapshot.empty) {
                    const carsData = [];
                    snapshot.forEach(docSnap => {
                        carsData.push({ id: docSnap.id, ...docSnap.data() });
                    });
                    renderGalleryList(carsData);
                } else {
                    renderGalleryList(localCarsGallery);
                }
            }, () => {
                renderGalleryList(localCarsGallery);
            });
        };
        if (window.location.hash === '#view-ankauf') window.ensureCarsLoaded();

        window.uploadNewCarMedia = async function(event) {
            const title = document.getElementById('newCarTitle').value;
            const fileInput = document.getElementById('newCarFile');
            if(!title || !fileInput.files[0]) { window.showToast('Bitte Modellnamen und Datei angeben.', 'error'); return; }
            
            const file = fileInput.files[0];
            if (file.size > 700 * 1024) {
                window.showToast('Datei ist größer als 700 KB. Bitte vorher komprimieren.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = async function(e) {
                const mediaUrl = e.target.result; 
                try {
                    await addDoc(collection(db, "cars"), { title, mediaUrl, timestamp: serverTimestamp() });
                    window.showToast('Fahrzeug erfolgreich veröffentlicht.', 'success');
                } catch(err) {
                    let localCarsList = JSON.parse(localStorage.getItem('red_local_cars_gallery_v2')) || [];
                    localCarsList.unshift({id: 'local-car-'+Date.now(), title, mediaUrl});
                    localStorage.setItem('red_local_cars_gallery_v2', JSON.stringify(localCarsList));
                    
                    const eventObj = new CustomEvent('localCarsUpdated', {detail: localCarsList});
                    window.dispatchEvent(eventObj);
                    
                    window.showToast('Lokal hinzugefügt.', 'error');
                }
                document.getElementById('newCarTitle').value = '';
                fileInput.value = '';
                document.getElementById('fileLabelText').innerHTML = `<i class="fa-solid fa-folder-open"></i> Datei auswählen`;
            };
            reader.readAsDataURL(file);
        };
        
        window.addEventListener('localCarsUpdated', (e) => {
            renderGalleryList(e.detail);
        });
        
        window.deleteGalleryImage = function(cardId) {
            window.openRedDeleteConfirm(
                'Fahrzeug entfernen?',
                'Möchten Sie dieses Fahrzeug wirklich dauerhaft aus der Galerie löschen?',
                async () => {
                    try {
                        await deleteDoc(doc(db, "cars", cardId));
                        window.showToast('Fahrzeug entfernt.', 'success');
                    } catch(err) {
                        const el = document.getElementById(cardId);
                        if(el) el.remove();
                        
                        let localCarsList = JSON.parse(localStorage.getItem('red_local_cars_gallery_v2')) || [];
                        localCarsList = localCarsList.filter(c => c.id !== cardId);
                        localStorage.setItem('red_local_cars_gallery_v2', JSON.stringify(localCarsList));
                        window.showToast('Erfolgreich entfernt.', 'success');
                    }
                }
            );
        };
