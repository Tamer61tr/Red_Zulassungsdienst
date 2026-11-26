window.escHtml = function(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        // =========================================================================
        // 0. DYNAMISCHER ÜBERLAPPUNGS-SCHUTZ (ECHTZEIT HEADER-HÖHENMESSUNG)
        // =========================================================================
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        window._userHasScrolledPage = false;
        window.addEventListener('touchmove', () => { window._userHasScrolledPage = true; }, { once: true, passive: true });
        window.addEventListener('wheel', () => { window._userHasScrolledPage = true; }, { once: true, passive: true });

        window.forceStartAtTop = function() {
            if (window._userHasScrolledPage) return;
            const prevBehavior = document.documentElement.style.scrollBehavior;
            document.documentElement.style.scrollBehavior = 'auto';
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            document.documentElement.style.scrollBehavior = prevBehavior;
        };

        window.syncHeaderHeight = function() {
            const headerEl = document.getElementById('header-wrapper');
            if (!headerEl || headerEl.classList.contains('header-compact')) return;
            const measuredHeight = Math.ceil(headerEl.getBoundingClientRect().height || headerEl.offsetHeight);
            if (measuredHeight > 40) {
                document.documentElement.style.setProperty('--dynamic-header-h', (measuredHeight + 14) + 'px');
            }
        };

        // =========================================================================
        // SMART-SCROLL-KOMPAKTMODUS, FORTSCHRITTSLINIE & DESKTOP-NAVIGATION
        // =========================================================================
        window._lastHeaderScrollY = 0;
        window._headerScrollTicking = false;

        window.updateHeaderNavActiveState = function(forcedViewId) {
            const links = document.querySelectorAll('#desktopHeaderNav .dhn-link');
            if (!links.length) return;

            const activeView = forcedViewId || (document.querySelector('.view-section.active')?.id || 'view-home');
            let activeKey = '';

            if (activeView !== 'view-home') {
                activeKey = activeView;
            } else {
                const y = window.scrollY + 180;
                const terminEl = document.getElementById('termin');
                const galEl = document.getElementById('realShopGalleryWrap');
                const toolsEl = document.getElementById('wunschkennzeichen-section');
                const leistEl = document.getElementById('leistungen');

                if (terminEl && y >= terminEl.offsetTop) activeKey = '';
                else if (galEl && y >= galEl.offsetTop - 80) activeKey = 'galerie';
                else if (toolsEl && y >= toolsEl.offsetTop) activeKey = 'tools';
                else if (leistEl && y >= leistEl.offsetTop) activeKey = 'leistungen';
            }

            links.forEach(a => {
                a.classList.toggle('is-active', a.getAttribute('data-nav-key') === activeKey);
            });
        };

        window.updateHeaderOnScroll = function() {
            window._headerScrollTicking = false;
            const y = window.scrollY || window.pageYOffset || 0;
            const headerEl = document.getElementById('header-wrapper');
            const bar = document.getElementById('headerScrollProgress');

            // 1. Rote Fortschrittslinie (0..100%)
            if (bar) {
                const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                const progress = maxScroll > 20 ? Math.min(1, Math.max(0, y / maxScroll)) : 0;
                bar.style.transform = `scaleX(${progress.toFixed(4)})`;
            }

            // 2. Smart-Scroll-Kompaktmodus (ab 120px beim Runterscrollen ein, beim Hochscrollen sofort aus)
            if (headerEl) {
                const delta = y - window._lastHeaderScrollY;
                if (y <= 65 || window._isBodyScrollLocked) {
                    headerEl.classList.remove('header-compact');
                } else if (y > 120 && delta > 6) {
                    headerEl.classList.add('header-compact');
                } else if (delta < -10) {
                    headerEl.classList.remove('header-compact');
                }
            }
            window._lastHeaderScrollY = y;

            // 3. Aktiven Desktop-Nav-Punkt aktualisieren
            window.updateHeaderNavActiveState();
        };

        window.addEventListener('scroll', () => {
            if (!window._headerScrollTicking) {
                window._headerScrollTicking = true;
                requestAnimationFrame(window.updateHeaderOnScroll);
            }
        }, { passive: true });

        window.desktopNavGo = function(targetId) {
            const headerEl = document.getElementById('header-wrapper');
            if (headerEl) headerEl.classList.remove('header-compact');
            if (typeof window.syncBodyScrollLock === 'function') window.syncBodyScrollLock();

            const isHome = (document.querySelector('.view-section.active')?.id === 'view-home');
            if (!isHome) {
                window.switchView('view-home');
            }

            const scrollToExactTarget = (smooth = true) => {
                const target = document.getElementById(targetId);
                if (!target) return;
                const headerH = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 130;
                const y = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - headerH - 14));
                window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
            };

            setTimeout(() => scrollToExactTarget(true), isHome ? 80 : 240);
            setTimeout(() => {
                const target = document.getElementById(targetId);
                if (!target) return;
                const headerH = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 130;
                const diff = target.getBoundingClientRect().top - (headerH + 14);
                if (Math.abs(diff) > 35) scrollToExactTarget(true);
            }, isHome ? 480 : 650);
        };

        window.jumpToBookingFromTicker = function() {
            window.desktopNavGo('termin');
        };

        // =========================================================================
        // HINTERGRUND-SCROLLSPERRE BEI GEÖFFNETEN FENSTERN / MENÜS / SHEETS
        // =========================================================================
        window._isBodyScrollLocked = false;
        window._lockTouchStartY = 0;
        window._lockTouchStartX = 0;

        window.hasOpenBlockingOverlay = function() {
            if (document.querySelector('.custom-dialog-overlay.open')) return true;
            const qMenu = document.getElementById('quickMenu');
            if (qMenu && qMenu.classList.contains('active')) return true;
            const mSel = document.getElementById('mobileSelectOverlay');
            if (mSel && mSel.classList.contains('open')) return true;
            const fBack = document.getElementById('fabBackdrop');
            if (fBack && fBack.classList.contains('open')) return true;
            const intro = document.getElementById('intro-preloader');
            if (intro && !intro.classList.contains('intro-preloader-done') && getComputedStyle(intro).display !== 'none') return true;
            return false;
        };

        window.syncBodyScrollLock = function() {
            const shouldLock = window.hasOpenBlockingOverlay();
            if (shouldLock && !window._isBodyScrollLocked) {
                window._isBodyScrollLocked = true;
                document.documentElement.classList.add('modal-scroll-lock');
                document.body.classList.add('modal-scroll-lock');
            } else if (!shouldLock && window._isBodyScrollLocked) {
                window._isBodyScrollLocked = false;
                document.documentElement.classList.remove('modal-scroll-lock');
                document.body.classList.remove('modal-scroll-lock');
            }
        };

        window.findActiveScrollableInsideOverlay = function(startNode) {
            let el = startNode;
            const overlayRoot = startNode && startNode.closest
                ? startNode.closest('.custom-dialog-overlay.open, #quickMenu.active, #mobileSelectOverlay.open')
                : null;
            if (!overlayRoot) return null;

            while (el && el !== overlayRoot && el !== document.body) {
                if (el.nodeType === 1) {
                    const style = getComputedStyle(el);
                    const canScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && (el.scrollHeight > el.clientHeight + 1);
                    const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && (el.scrollWidth > el.clientWidth + 1);
                    if (canScrollY || canScrollX) return { el, canScrollY, canScrollX };
                }
                el = el.parentElement;
            }
            if (overlayRoot.id === 'quickMenu' && overlayRoot.scrollHeight > overlayRoot.clientHeight + 1) {
                return { el: overlayRoot, canScrollY: true, canScrollX: false };
            }
            return null;
        };

        document.addEventListener('touchstart', (e) => {
            if (!window._isBodyScrollLocked || !e.touches || !e.touches[0]) return;
            window._lockTouchStartY = e.touches[0].clientY;
            window._lockTouchStartX = e.touches[0].clientX;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!window._isBodyScrollLocked) return;
            if (e.target && e.target.closest && e.target.closest('.signature-pad-wrapper')) return;
            if (e.target && e.target.closest && e.target.closest('#cashInvoiceOverlay')) return;
            const scrollInfo = window.findActiveScrollableInsideOverlay(e.target);
            if (!scrollInfo) {
                e.preventDefault();
                return;
            }
            if (!e.touches || !e.touches[0]) return;
            const dy = e.touches[0].clientY - window._lockTouchStartY;
            const dx = e.touches[0].clientX - window._lockTouchStartX;
            if (scrollInfo.canScrollX && Math.abs(dx) > Math.abs(dy)) return;
            if (!scrollInfo.canScrollY) {
                e.preventDefault();
                return;
            }
            const { el } = scrollInfo;
            const atTop = el.scrollTop <= 0 && dy > 0;
            const atBottom = (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) && dy < 0;
            if (atTop || atBottom) e.preventDefault();
        }, { passive: false });

        document.addEventListener('wheel', (e) => {
            if (!window._isBodyScrollLocked) return;
            const scrollInfo = window.findActiveScrollableInsideOverlay(e.target);
            if (!scrollInfo || !scrollInfo.canScrollY) {
                e.preventDefault();
                return;
            }
            const { el } = scrollInfo;
            const atTop = el.scrollTop <= 0 && e.deltaY < 0;
            const atBottom = (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) && e.deltaY > 0;
            if (atTop || atBottom) e.preventDefault();
        }, { passive: false });

        // =========================================================================
        // BERLINER FEIERTAGS-ENGINE (INKL. 8. MÄRZ & DYNAMISCHER OSTERBERECHNUNG)
        // =========================================================================
        window._berlinHolidayCache = {};

        window.getBerlinHolidaysForYear = function(year) {
            if (window._berlinHolidayCache[year]) return window._berlinHolidayCache[year];
            const pad = (n) => String(n).padStart(2, '0');
            const toKey = (utcDate) => `${utcDate.getUTCFullYear()}-${pad(utcDate.getUTCMonth() + 1)}-${pad(utcDate.getUTCDate())}`;
            const addDays = (base, days) => new Date(base.getTime() + days * 86400000);

            // Gaußsche Osterformel (funktioniert dauerhaft für jedes Jahr)
            const a = year % 19, b = Math.floor(year / 100), c = year % 100;
            const d = Math.floor(b / 4), e = b % 4;
            const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
            const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.floor(c / 4), k = c % 4;
            const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.floor((a + 11 * h + 22 * l) / 451);
            const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
            const easterDay = ((h + l - 7 * m + 114) % 31) + 1;
            const easter = new Date(Date.UTC(year, easterMonth - 1, easterDay));

            const holidays = {};
            holidays[`${year}-01-01`] = 'Neujahr';
            holidays[`${year}-03-08`] = 'Weltfrauentag';
            holidays[toKey(addDays(easter, -2))] = 'Karfreitag';
            holidays[toKey(addDays(easter, 1))] = 'Ostermontag';
            holidays[`${year}-05-01`] = 'Tag der Arbeit';
            holidays[toKey(addDays(easter, 39))] = 'Christi Himmelfahrt';
            holidays[toKey(addDays(easter, 50))] = 'Pfingstmontag';
            holidays[`${year}-10-03`] = 'Tag der Deutschen Einheit';
            holidays[`${year}-12-25`] = '1. Weihnachtstag';
            holidays[`${year}-12-26`] = '2. Weihnachtstag';

            window._berlinHolidayCache[year] = holidays;
            return holidays;
        };

        window.isBerlinHolidayYMD = function(year, month, day) {
            const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return window.getBerlinHolidaysForYear(year)[key] || null;
        };

        window.getBerlinHolidayName = function(dateObj) {
            if (!dateObj) return null;
            return window.isBerlinHolidayYMD(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
        };

        window.getBerlinNowParts = function() {
            try {
                const parts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/Berlin',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).formatToParts(new Date());
                const map = {};
                parts.forEach(p => { map[p.type] = p.value; });
                const dayLookup = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
                return {
                    year: parseInt(map.year, 10),
                    month: parseInt(map.month, 10),
                    day: parseInt(map.day, 10),
                    dayNum: dayLookup[map.weekday],
                    h: parseInt(map.hour, 10) % 24,
                    m: parseInt(map.minute, 10),
                    s: parseInt(map.second, 10)
                };
            } catch (e) {
                const now = new Date();
                return {
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                    day: now.getDate(),
                    dayNum: now.getDay(),
                    h: now.getHours(),
                    m: now.getMinutes(),
                    s: now.getSeconds()
                };
            }
        };

        // Direkt-Sprung zum Live-Tracker aus der Header-Leiste
        window.jumpToLiveTracker = function() {
            const isHome = (document.querySelector('.view-section.active')?.id === 'view-home');
            if (!isHome) window.switchView('view-home');
            setTimeout(() => {
                const input = document.getElementById('liveTrackerInput');
                const section = input ? input.closest('section') : null;
                if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (input) setTimeout(() => input.focus({ preventScroll: true }), 420);
            }, isHome ? 20 : 120);
        };

        // =========================================================================
        // MINI ÖFFNUNGSZEITEN-COUNTDOWN IM HEADER (BERLINER ZEIT + FEIERTAGE)
        // =========================================================================
        window.updateHeaderHoursCountdown = function() {
            const box = document.getElementById('headerHoursCountdown');
            const lbl = document.getElementById('hhcHoursLabel');
            const timer = document.getElementById('hhcCountdownText');
            if (!box || !lbl || !timer) return;

            const bn = window.getBerlinNowParts();
            const todayHoliday = window.isBerlinHolidayYMD(bn.year, bn.month, bn.day);
            const nowSec = bn.h * 3600 + bn.m * 60 + bn.s;
            const openSec = 9 * 3600;
            const closeSec = 20 * 3600;
            const isWorkday = (bn.dayNum >= 1 && bn.dayNum <= 5) && !todayHoliday;
            const isOpen = isWorkday && nowSec >= openSec && nowSec < closeSec;
            const pad = (n) => String(n).padStart(2, '0');

            if (isOpen) {
                const remSec = closeSec - nowSec;
                const rh = Math.floor(remSec / 3600);
                const rm = Math.floor((remSec % 3600) / 60);
                const rs = remSec % 60;
                box.classList.add('is-open');
                box.classList.remove('is-closed');
                box.title = 'Geöffnet (Mo–Fr 09:00–20:00 Uhr, Berlin)';
                lbl.innerText = 'Offen • 09–20';
                timer.innerText = `Noch ${pad(rh)}:${pad(rm)}:${pad(rs)}`;
                const termPill = document.getElementById('adminTerminalHoursPill');
                if (termPill) {
                    termPill.classList.add('is-open');
                    termPill.classList.remove('is-closed');
                    const tl = document.getElementById('alhStatusLabel');
                    const tv = document.getElementById('alhCountdownVal');
                    if (tl) tl.innerText = 'Offen (09–20)';
                    if (tv) tv.innerText = `${pad(rh)}:${pad(rm)}:${pad(rs)}`;
                }
            } else {
                let remSec = 0;
                if (isWorkday && nowSec < openSec) {
                    remSec = openSec - nowSec;
                } else {
                    for (let offsetDays = 1; offsetDays <= 14; offsetDays++) {
                        const nextUtc = new Date(Date.UTC(bn.year, bn.month - 1, bn.day + offsetDays));
                        const wd = nextUtc.getUTCDay();
                        const ny = nextUtc.getUTCFullYear();
                        const nm = nextUtc.getUTCMonth() + 1;
                        const nd = nextUtc.getUTCDate();
                        if (wd >= 1 && wd <= 5 && !window.isBerlinHolidayYMD(ny, nm, nd)) {
                            remSec = (86400 - nowSec) + ((offsetDays - 1) * 86400) + openSec;
                            break;
                        }
                    }
                }

                const days = Math.floor(remSec / 86400);
                const rh = Math.floor((remSec % 86400) / 3600);
                const rm = Math.floor((remSec % 3600) / 60);
                const rs = remSec % 60;

                box.classList.remove('is-open');
                box.classList.add('is-closed');
                box.title = todayHoliday
                    ? `Feiertag in Berlin (${todayHoliday}) – Regulär Mo–Fr 09:00–20:00 Uhr`
                    : 'Öffnungszeiten Mo–Fr 09:00–20:00 Uhr (Berlin)';
                lbl.innerText = todayHoliday ? 'Feiertag • Zu' : 'Mo–Fr 09–20';
                timer.innerText = days > 0
                    ? `In ${days}T ${pad(rh)}:${pad(rm)}:${pad(rs)}`
                    : `Öffnet ${pad(rh)}:${pad(rm)}:${pad(rs)}`;
                const termPill = document.getElementById('adminTerminalHoursPill');
                if (termPill) {
                    termPill.classList.remove('is-open');
                    termPill.classList.add('is-closed');
                    const tl = document.getElementById('alhStatusLabel');
                    const tv = document.getElementById('alhCountdownVal');
                    if (tl) tl.innerText = todayHoliday ? 'Feiertag' : 'Mo–Fr 09–20';
                    if (tv) tv.innerText = days > 0 ? `In ${days}T ${pad(rh)}:${pad(rm)}` : `${pad(rh)}:${pad(rm)}:${pad(rs)}`;
                }
            }
        };

        window.addEventListener('resize', window.syncHeaderHeight, { passive: true });
        window.addEventListener('orientationchange', () => setTimeout(window.syncHeaderHeight, 150), { passive: true });
        window.addEventListener('load', () => {
            window.syncHeaderHeight();
            window.forceStartAtTop();
            setTimeout(window.forceStartAtTop, 120);
        });
        window.addEventListener('pageshow', () => {
            window.syncHeaderHeight();
            window.forceStartAtTop();
        });

        document.addEventListener('DOMContentLoaded', () => {
            window.syncHeaderHeight();
            window.forceStartAtTop();
            setTimeout(() => { window.syncHeaderHeight(); window.forceStartAtTop(); }, 180);
            setTimeout(() => { window.syncHeaderHeight(); window.forceStartAtTop(); }, 450);

            const headerEl = document.getElementById('header-wrapper');
            if (headerEl && typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => window.syncHeaderHeight());
                ro.observe(headerEl);
            }

            // Öffnungszeiten-Countdown live jede Sekunde (pausiert bei inaktivem Tab)
            window.updateHeaderHoursCountdown();
            setInterval(() => { if (!document.hidden) window.updateHeaderHoursCountdown(); }, 1000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) window.updateHeaderHoursCountdown(); });

            // Scroll-Lock automatisch an alle Overlays, Menüs & Sheets koppeln
            const lockTargets = [
                ...Array.from(document.querySelectorAll('.custom-dialog-overlay')),
                document.getElementById('quickMenu'),
                document.getElementById('mobileSelectOverlay'),
                document.getElementById('fabBackdrop'),
                document.getElementById('intro-preloader')
            ].filter(Boolean);

            const lockObs = new MutationObserver(() => {
                window.syncBodyScrollLock();
                const intro = document.getElementById('intro-preloader');
                if (intro && intro.classList.contains('intro-preloader-done')) {
                    window.forceStartAtTop();
                }
            });
            lockTargets.forEach(el => lockObs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }));
            window.syncBodyScrollLock();
        });

        // =========================================================================
        // NEUHEIT 1, 2 & 3: LIVE ABHOL-PROGNOSE, MERKZETTEL AUFS HANDY & ADRESS-KOPIERER
        // =========================================================================
        window.updatePickupForecast = function() {
            const dropoff = document.getElementById('pickupDropoffSelect')?.value || 'morning';
            const srv = document.getElementById('pickupServiceSelect')?.value || 'express';
            const resEl = document.getElementById('pickupForecastResult');
            if (!resEl) return;

            if (srv === 'plates_only') {
             resEl.innerHTML = `<i class="fa-solid fa-id-card" style="color:var(--green-accent); margin-right:5px;"></i><strong style="color:var(--green-accent);">Sofort zum Mitnehmen (ca. 3–5 Minuten):</strong> Ihre Kennzeichenschilder (Alu, 3D-Carbon oder Kurzkennzeichen) sowie die grüne Umweltplakette prägen wir direkt bei Ihrem Besuch.`;
             return;
         }
         if (srv === 'kurzzeit') {
             if (dropoff === 'morning' || dropoff === 'noon') {
                 resEl.innerHTML = `<i class="fa-solid fa-stopwatch" style="color:var(--green-accent); margin-right:5px;"></i><strong style="color:var(--green-accent);">Gleicher Werktag / Sofort-Service:</strong> Bei Abgabe bis 15:00 Uhr sind Ihre 6-Tage-Kurzzeit- oder Zollkennzeichen inkl. Papieren meist noch <strong>am selben Tag abholbereit</strong>.`;
             } else {
                 resEl.innerHTML = `<i class="fa-solid fa-stopwatch" style="color:var(--green-accent); margin-right:5px;"></i><strong style="color:var(--green-accent);">Nächster Werktag:</strong> Ihre Unterlagen gehen direkt in den ersten Morgen-Lauf und sind <strong>am nächsten Werktag ab Mittag abholbereit</strong>.`;
             }
             return;
         }
         if (srv === 'express') {
             if (dropoff === 'morning') {
                 resEl.innerHTML = `<i class="fa-solid fa-bolt" style="color:var(--green-accent); margin-right:5px;"></i><strong style="color:var(--green-accent);">Express-Priorisierung (Gleicher Tag / 24h):</strong> Direkte Einreichung im ersten Behörden-Lauf – Fertigstellung meist noch <strong>heute am Spätnachmittag oder morgen Vormittag</strong>.`;
             } else {
                 resEl.innerHTML = `<i class="fa-solid fa-bolt" style="color:var(--green-accent); margin-right:5px;"></i><strong style="color:var(--green-accent);">Express-Priorisierung (ca. 24 Stunden):</strong> Priorisierte Einreichung beim LABO Berlin – Ihre fertigen Papiere & Schilder sind in der Regel <strong>innerhalb von 24h abholbereit</strong>.`;
             }
             return;
         }
         resEl.innerHTML = `<i class="fa-solid fa-car" style="color:var(--primary-red); margin-right:5px;"></i><strong style="color:var(--primary-red);">Reguläre Bearbeitungszeit (1–2 Werktage):</strong> Wir übernehmen den kompletten Behördengang inkl. Schilderprägung. Sobald im Live-Tracker „Abholbereit“ leuchtet, können Sie alles abholen.`;
        };

        window.sendCompassDocsToWhatsApp = function() {
            const caseTitle = document.getElementById('compassCaseTitle')?.innerText || 'Kfz-Zulassung Berlin';
            const docItems = Array.from(document.querySelectorAll('#compassDocList li')).map(li => {
                const icon = li.getAttribute('data-checked') === '1' ? '✅' : '⬜';
                return `${icon} ${li.innerText.trim()}`;
            });
            const listText = docItems.length > 0
                ? docItems.join('\n')
                : '⬜ Fahrzeugschein (ZB I) & Fahrzeugbrief (ZB II)\n⬜ Gültiger Ausweis / Reisepass + Meldebescheinigung\n⬜ 7-stellige eVB-Nummer\n⬜ Gültiger TÜV / HU-Bericht & IBAN';

            const msg = encodeURIComponent(`📋 *MEINE UNTERLAGEN-CHECKLISTE (RED BERLIN)*\n*Vorgang:* ${caseTitle}\n\n${listText}\n\n📍 *Abgabe-Adresse:*\nRED Zulassungsdienst Berlin\nKienitzer Str. 6, 12053 Berlin (U7 Karl-Marx-Str. & U8 Boddinstraße)\n🕒 Mo–Fr 09:00–20:00 Uhr\n📞 Tel: 0178 378 38 75`);
            window.open(`https://wa.me/?text=${msg}`, '_blank');
        };

        window.copyOfficeAddress = function() {
            const addr = 'RED Zulassungsdienst Berlin, Kienitzer Str. 6, 12053 Berlin';
            navigator.clipboard.writeText(addr).then(() => {
                window.showToast('📍 Adresse (Kienitzer Str. 6, 12053 Berlin) kopiert!', 'success');
            }).catch(() => {
                window.showToast('📍 Kienitzer Str. 6, 12053 Berlin', 'success');
            });
        };

        // =========================================================================
        // DYNAMISCHE KALENDERWOCHEN (KW) BEIM MONATS- & WOCHENWECHSEL
        // =========================================================================
        window.getISOWeekNumber = function(d) {
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        };

        window.updateHeaderCalendarChip = function() {
            const el = document.getElementById('headerCalendarKwText');
            if (!el) return;
            const now = new Date();
            const kw = window.getISOWeekNumber(now);
            const monthShort = now.toLocaleDateString('de-DE', { month: 'short' });
            el.innerText = `KW ${kw} • ${monthShort}`;
        };

        window.calModalYear = new Date().getFullYear();
        window.calModalMonth = new Date().getMonth();

        window.changeHeaderCalMonth = function(delta) {
            window.calModalMonth += delta;
            if (window.calModalMonth > 11) { window.calModalMonth = 0; window.calModalYear++; }
            if (window.calModalMonth < 0) { window.calModalMonth = 11; window.calModalYear--; }
            window.renderHeaderInteractiveCalendar();
        };

        window.jumpToCurrentCalMonth = function() {
            const now = new Date();
            window.calModalYear = now.getFullYear();
            window.calModalMonth = now.getMonth();
            window.renderHeaderInteractiveCalendar();
        };

        window.renderHeaderInteractiveCalendar = function() {
            const content = document.getElementById('widgetModalContent');
            if (!content) return;

            const now = new Date();
            const yr = window.calModalYear;
            const mo = window.calModalMonth;
            const firstDay = new Date(yr, mo, 1);
            const lastDay = new Date(yr, mo + 1, 0);
            const daysInMonth = lastDay.getDate();

            const startKw = window.getISOWeekNumber(firstDay);
            const endKw = window.getISOWeekNumber(lastDay);
            const kwSpanText = startKw === endKw ? `KW ${startKw}` : `KW ${startKw} – KW ${endKw}`;

            const headerChip = document.getElementById('headerCalendarKwText');
            if (headerChip) {
                const mShort = firstDay.toLocaleDateString('de-DE', { month: 'short' });
                headerChip.innerText = (yr === now.getFullYear() && mo === now.getMonth())
                    ? `KW ${window.getISOWeekNumber(now)} • ${mShort}`
                    : `${kwSpanText} • ${mShort}`;
            }

            let startWeekday = firstDay.getDay() - 1;
            if (startWeekday < 0) startWeekday = 6;

            const monthTitle = firstDay.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

            let gridHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:var(--bg-input); padding:8px 10px; border-radius:12px; border:1px solid var(--glass-border); gap:6px;">
                    <button type="button" onclick="window.changeHeaderCalMonth(-1)" style="background:var(--bg-card); border:1px solid var(--glass-border); color:var(--text-light); width:32px; height:32px; border-radius:8px; cursor:pointer; font-weight:900;">‹</button>
                    <div style="text-align:center;">
                        <strong style="color:var(--primary-red); font-size:14px; text-transform:uppercase; display:block;">${monthTitle}</strong>
                        <span style="font-size:10.5px; color:var(--text-light); font-weight:800; background:rgba(230,0,0,0.1); padding:2px 8px; border-radius:10px; display:inline-block; margin-top:2px;">📅 ${kwSpanText}</span>
                    </div>
                    <div style="display:flex; gap:4px;">
                        <button type="button" onclick="window.jumpToCurrentCalMonth()" title="Zu Heute springen" style="background:var(--bg-card); border:1px solid var(--primary-red); color:var(--primary-red); padding:0 8px; height:32px; border-radius:8px; cursor:pointer; font-size:10px !important; font-weight:800;">Heute</button>
                        <button type="button" onclick="window.changeHeaderCalMonth(1)" style="background:var(--bg-card); border:1px solid var(--glass-border); color:var(--text-light); width:32px; height:32px; border-radius:8px; cursor:pointer; font-weight:900;">›</button>
                    </div>
                </div>
                <div class="mini-cal-grid">
                    <div class="mini-cal-weekday" style="color:var(--text-muted);">KW</div>
                    <div class="mini-cal-weekday">Mo</div>
                    <div class="mini-cal-weekday">Di</div>
                    <div class="mini-cal-weekday">Mi</div>
                    <div class="mini-cal-weekday">Do</div>
                    <div class="mini-cal-weekday">Fr</div>
                    <div class="mini-cal-weekday" style="color:var(--text-muted);">Sa</div>
                    <div class="mini-cal-weekday" style="color:var(--text-muted);">So</div>
            `;

            let currentCell = 0;
            gridHtml += `<div class="mini-cal-kw-badge">KW ${window.getISOWeekNumber(firstDay)}</div>`;

            for (let i = 0; i < startWeekday; i++) {
                gridHtml += `<div class="mini-cal-day empty"></div>`;
                currentCell++;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const curDate = new Date(yr, mo, d);
                if (currentCell > 0 && currentCell % 7 === 0) {
                    const rowKw = window.getISOWeekNumber(curDate);
                    gridHtml += `<div class="mini-cal-kw-badge">KW ${rowKw}</div>`;
                }

                const wDay = curDate.getDay();
                const isWeekend = (wDay === 0 || wDay === 6);
                const holidayName = window.getBerlinHolidayName(curDate);
                const isToday = (d === now.getDate() && mo === now.getMonth() && yr === now.getFullYear());
                const isPast = curDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const isBlocked = isWeekend || !!holidayName || isPast;
                const formattedDate = `${String(d).padStart(2, '0')}.${String(mo + 1).padStart(2, '0')}.${yr}`;
                const dayKw = window.getISOWeekNumber(curDate);

                let cls = 'mini-cal-day';
                if (isToday) cls += ' today';
                if (isBlocked) cls += ' weekend';

                const blockedReason = holidayName ? `Feiertag: ${holidayName}` : (isWeekend ? 'Wochenende' : 'Vergangener Tag');
                const clickAttr = !isBlocked
                    ? `onclick="window.selectDayFromHeaderCalendar('${formattedDate}', ${dayKw})" title="KW ${dayKw}: Klicken, um am ${formattedDate} einen Termin zu buchen"`
                    : `title="KW ${dayKw} (${blockedReason})"`;

                gridHtml += `<div class="${cls}" ${clickAttr}>${d}</div>`;
                currentCell++;
            }

            gridHtml += `</div>
                <p style="font-size:11px; color:var(--text-muted); margin-top:12px;">
                    💡 <strong>Direkt-Auswahl:</strong> Tippen Sie auf einen freien Werktag (Mo–Fr), um dieses Datum direkt im Terminformular zu öffnen!
                </p>
            `;
            content.innerHTML = gridHtml;
        };

        window.selectDayFromHeaderCalendar = function(dateStr, kwNum) {
            if (kwNum && document.getElementById('headerCalendarKwText')) {
                document.getElementById('headerCalendarKwText').innerText = `KW ${kwNum} • ${dateStr.substring(0, 5)}`;
            }
            window.closeWidgetModal();
            window.switchView('view-home');
            setTimeout(() => {
                const dp = document.getElementById('datePicker');
                if (dp) {
                    dp.value = dateStr;
                    if (dp._flatpickr) {
                        dp._flatpickr.setDate(dateStr, true);
                    }
                }
                document.getElementById('termin').scrollIntoView({ behavior: 'smooth' });
                window.showToast(`📅 Wunschdatum ${dateStr} (KW ${kwNum || ''}) gewählt!`, 'success');
            }, 250);
        };

        // =========================================================================
        // PROGRESSIVE WEB APP (PWA) INSTALLATIONS-ENGINE (iOS & ANDROID/SAMSUNG)
        // =========================================================================
        window.deferredPwaPrompt = null;

        window.initPwaSystem = function() {
            if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('./sw.js').catch(() => {});
                });
            }

            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.deferredPwaPrompt = e;
                const nativeBox = document.getElementById('pwaNativeBtnContainer');
                if (nativeBox) nativeBox.style.display = 'block';
            });

            window.addEventListener('appinstalled', () => {
                window.deferredPwaPrompt = null;
                window.closePwaInstallModal();
                window.showToast('🎉 RED Berlin App erfolgreich installiert!', 'success');
            });
        };

        window.triggerAppInstall = async function() {
            if (window.deferredPwaPrompt) {
                try {
                    window.deferredPwaPrompt.prompt();
                    const { outcome } = await window.deferredPwaPrompt.userChoice;
                    if (outcome === 'accepted') {
                        window.deferredPwaPrompt = null;
                        return;
                    }
                } catch (err) {}
            }
            const nativeBox = document.getElementById('pwaNativeBtnContainer');
            if (nativeBox) nativeBox.style.display = window.deferredPwaPrompt ? 'block' : 'none';
            document.getElementById('pwaInstallOverlay').classList.add('open');
        };

        window.executeNativePwaPrompt = async function() {
            if (!window.deferredPwaPrompt) return;
            window.deferredPwaPrompt.prompt();
            const { outcome } = await window.deferredPwaPrompt.userChoice;
            if (outcome === 'accepted') {
                window.deferredPwaPrompt = null;
                window.closePwaInstallModal();
            }
        };

        window.closePwaInstallModal = function() {
            document.getElementById('pwaInstallOverlay').classList.remove('open');
        };

        // =========================================================================
        // LIVE eVB-, IBAN- & FIN-PRÜFER (100% LOKAL IM BROWSER)
        // =========================================================================
        window.validateCustomerDocsLive = function() {
            const evbEl = document.getElementById('chkEvbInput');
            const finEl = document.getElementById('chkFinInput');
            const ibanEl = document.getElementById('chkIbanInput');

            const evbStat = document.getElementById('chkEvbStatus');
            const finStat = document.getElementById('chkFinStatus');
            const ibanStat = document.getElementById('chkIbanStatus');

            if (evbEl && evbStat) {
                const val = evbEl.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                evbEl.value = val;
                if (val.length === 0) {
                    evbStat.style.color = 'var(--text-muted)';
                    evbStat.innerText = 'Noch 7 Zeichen eingeben';
                } else if (val.length === 7) {
                    evbStat.style.color = 'var(--green-accent)';
                    evbStat.innerHTML = '✅ Gültiges 7-stelliges eVB-Format!';
                } else {
                    evbStat.style.color = '#ff9500';
                    evbStat.innerText = `Aktuell ${val.length}/7 Zeichen`;
                }
            }

            if (finEl && finStat) {
                const rawVal = finEl.value.toUpperCase();
                const hasForbidden = /[IOQ]/.test(rawVal);
                const cleanVal = rawVal.replace(/[^A-Z0-9]/g, '');
                finEl.value = cleanVal;

                if (cleanVal.length === 0) {
                    finStat.style.color = 'var(--text-muted)';
                    finStat.innerText = 'Optional: 17-stellige FIN';
                } else if (hasForbidden) {
                    finStat.style.color = '#ff3b30';
                    finStat.innerHTML = '⚠️ Hinweis: Buchstaben I, O, Q gibt es in keiner FIN (bitte 1 oder 0 prüfen)!';
                } else if (cleanVal.length === 17) {
                    finStat.style.color = 'var(--green-accent)';
                    finStat.innerHTML = '✅ Exakt 17 Zeichen – FIN-Format korrekt!';
                } else {
                    finStat.style.color = '#ff9500';
                    finStat.innerText = `Aktuell ${cleanVal.length}/17 Zeichen`;
                }
            }

            if (ibanEl && ibanStat) {
                const cleanIban = ibanEl.value.replace(/\s+/g, '').toUpperCase();
                const formattedIban = cleanIban.replace(/(.{4})/g, '$1 ').trim();
                ibanEl.value = formattedIban;

                if (cleanIban.length === 0) {
                    ibanStat.style.color = 'var(--text-muted)';
                    ibanStat.innerText = 'Format: DE + 20 Ziffern';
                } else if (cleanIban.startsWith('DE') && cleanIban.length === 22 && /^DE\d{20}$/.test(cleanIban)) {
                    ibanStat.style.color = 'var(--green-accent)';
                    ibanStat.innerHTML = '✅ Deutsche IBAN (22 Zeichen) formal vollständig!';
                } else if (cleanIban.startsWith('DE')) {
                    ibanStat.style.color = '#ff9500';
                    ibanStat.innerText = `Deutsche IBAN: ${cleanIban.length}/22 Zeichen`;
                } else {
                    ibanStat.style.color = '#007aff';
                    ibanStat.innerText = `Auslands-IBAN (${cleanIban.length} Zeichen)`;
                }
            }
        };

        window.transferCheckedDocsToVollmacht = function() {
            const evb = document.getElementById('chkEvbInput')?.value.trim() || '';
            const fin = document.getElementById('chkFinInput')?.value.trim() || '';
            const iban = document.getElementById('chkIbanInput')?.value.trim() || '';

            if (evb && document.getElementById('dvEvb')) {
                document.getElementById('dvEvb').value = `eVB: ${evb}`;
            }
            if (fin && document.getElementById('dvVehicle')) {
                document.getElementById('dvVehicle').value = fin;
            }
            if (iban && document.getElementById('dvIban')) {
                document.getElementById('dvIban').value = iban;
            }
            window.openDigitalVollmachtModal('Allgemeine Vollmacht & SEPA-Mandat');
            window.showToast('Geprüfte Daten direkt in die Vollmacht übernommen!', 'success');
        };

        // =========================================================================
        // LABO-GEBÜHREN & BERLINER UMWELTPLAKETTEN-RECHNER
        // =========================================================================
        window.calculateLaboAndEnvGuide = function() {
            const feeCase = document.getElementById('laboFeeCaseSelect')?.value || 'ummeldung_berlin';
            const fuelType = document.getElementById('envBadgeFuelSelect')?.value || 'benzin_euro4';
            const titleEl = document.getElementById('envBadgeResultTitle');
            const descEl = document.getElementById('laboFeeResultDesc');
            if (!titleEl || !descEl) return;

            const feeMap = {
                'ummeldung_berlin': { price: 'ca. 26,00&nbsp;€ – 31,00&nbsp;€', note: 'Halterwechsel innerhalb Berlins' },
                'ummeldung_auswaerts': { price: 'ca. 30,00&nbsp;€ – 36,00&nbsp;€', note: 'Umschreibung von außerhalb nach Berlin' },
                'neuzulassung': { price: 'ca. 28,00&nbsp;€ – 34,00&nbsp;€', note: 'Fabrikneues Fahrzeug inkl. Stempel' },
                'wiederzulassung': { price: 'ca. 29,00&nbsp;€ – 35,00&nbsp;€', note: 'Wiederzulassung nach Stilllegung' },
                'kurzzeit': { price: 'ca. 13,10&nbsp;€', note: 'Amtliche Gebühr für 6-Tage-Kurzzeitkennzeichen' },
                'zoll': { price: 'ca. 34,00&nbsp;€ – 42,00&nbsp;€', note: 'Amtliche Gebühr für Ausfuhr-/Zollkennzeichen' },
                'abmeldung': { price: 'ca. 16,50&nbsp;€', note: 'Amtliche Gebühr für Außerbetriebsetzung' }
            };

            if (fuelType === 'elektro') {
                titleEl.style.color = 'var(--green-accent)';
                titleEl.innerHTML = '<i class="fa-solid fa-bolt" style="margin-right:5px;"></i>E-Kennzeichen & Grüne Plakette (Stufe 4) – Volle Elektro-Privilegien in Berlin.';
            } else if (fuelType === 'oldtimer') {
                titleEl.style.color = 'var(--gold-accent)';
                titleEl.innerHTML = '<i class="fa-solid fa-landmark" style="margin-right:5px;"></i>H-Oldtimer-Sonderrecht – Freie Fahrt in der gesamten Berliner Umweltzone (ohne Plakettenpflicht).';
            } else if (fuelType === 'alt_diesel') {
                titleEl.style.color = '#d97706';
                titleEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="margin-right:5px;"></i>Hinweis: Ohne Partikelfilter keine grüne Plakette – wir beraten Sie gerne zu Nachrüstung oder Ausnahmen.';
            } else {
                titleEl.style.color = 'var(--green-accent)';
                titleEl.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right:5px;"></i>Grüne Feinstaubplakette (Stufe 4) – Freie Fahrt in ganz Berlin!';
            }

            const selectedFee = feeMap[feeCase] || { price: 'ca. 28,00&nbsp;€', note: 'Amtlicher Richtwert' };
            descEl.innerHTML = `Amtlicher LABO-Gebühren-Richtwert: <strong class="nowrap-unit">${selectedFee.price}</strong><span class="paren-sub">(${selectedFee.note} • zzgl. 12,80&nbsp;€ bei Wunschkennzeichen)</span>Grüne Umweltplakette stellen wir direkt vor Ort aus.`;
        };

        // =========================================================================
        // 60-SEKUNDEN RÜCKRUF-SERVICE MODAL
        // =========================================================================
        window.openCallbackModal = function() {
            document.getElementById('callbackRequestOverlay').classList.add('open');
        };
        window.closeCallbackModal = function() {
            document.getElementById('callbackRequestOverlay').classList.remove('open');
        };

        window.submitCallbackRequest = async function(viaWhatsApp = false) {
            const name = document.getElementById('cbReqName')?.value.trim() || '';
            const phone = document.getElementById('cbReqPhone')?.value.trim() || '';
            const timeSlot = document.getElementById('cbReqTime')?.value || 'Sofort / Schnellstmöglich';
            const topic = document.getElementById('cbReqTopic')?.value || 'Kfz-Anmeldung';

            if (!name || !phone) {
                window.showToast('Bitte Ihren Namen und Ihre Telefonnummer eingeben.', 'error');
                return;
            }

            const todayDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const cbAptData = {
                name: name,
                phone: phone,
                email: 'Rückruf-Wunsch',
                date: todayDate,
                timeLabel: timeSlot,
                service: `📞 RÜCKRUF: ${topic}`,
                category: 'Express-Rückruf',
                customNote: `Bitte zurückrufen (${timeSlot})`,
                marked: true,
                orderStatus: 1,
                notes: [{ id: Date.now().toString(), text: `Rückruf angefordert für: ${topic} (${timeSlot})`, timeStr: '60s Rückruf-Service' }],
                timestamp: Date.now()
            };

            if (window.firebaseDb && window.firebaseAddDoc) {
                try {
                    await window.firebaseAddDoc(window.firebaseCollection(window.firebaseDb, "appointments"), cbAptData);
                } catch (e) {}
            }

            await window.sendToMakeWebhook({
                type: 'callback_request',
                clientName: name,
                clientCategory: 'Express-Rückruf',
                clientPhone: phone,
                clientEmail: '-',
                date: todayDate,
                time: timeSlot,
                service: `Rückruf: ${topic}`,
                wunschkennzeichen: '-',
                customNote: `Bitte zurückrufen (${timeSlot})`
            });

            if (viaWhatsApp) {
                let waPhone = (window.dynamicContactData?.phone || '01783783875').replace(/\D/g, '');
                if (waPhone.startsWith('0')) waPhone = '49' + waPhone.substring(1);
                const msg = encodeURIComponent(`📞 *60s EXPRESS-RÜCKRUF ANFRAGE*\n\n• *Name:* ${name}\n• *Telefon:* ${phone}\n• *Wunschzeit:* ${timeSlot}\n• *Thema:* ${topic}`);
                window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
            }

            window.closeCallbackModal();
            document.getElementById('cbReqName').value = '';
            document.getElementById('cbReqPhone').value = '';
            window.showToast('📞 Rückruf-Wunsch eingetragen! Wir melden uns in Kürze.', 'success');
        };

        // =========================================================================
        // 1-KLICK BERLINER WUNSCHKENNZEICHEN-IDEEN-GENERATOR
        // =========================================================================
        window.generatePlateIdea = function(mode) {
            const lettersEl = document.getElementById('wkLetters');
            const numbersEl = document.getElementById('wkNumbers');
            const typeEl = document.getElementById('wkType');
            const styleEl = document.getElementById('wkStyle');
            if (!lettersEl || !numbersEl) return;

            const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
            const yr = String(window.getDynamicSystemYear());

            if (mode === 'schnaps') {
                lettersEl.value = pick(['TY', 'EX', 'VIP', 'AA', 'ZZ', 'MM', 'KK', 'BB']).substring(0, 2);
                numbersEl.value = pick(['111', '222', '333', '555', '777', '888', '999', '8888', '77']);
                if (typeEl) typeEl.value = '';
                if (styleEl) styleEl.value = 'carbon';
            } else if (mode === 'short') {
                lettersEl.value = pick(['T', 'R', 'B', 'X', 'V', 'M', 'A', 'K']);
                numbersEl.value = pick(['1', '7', '9', '10', '61', '88', '99']);
                if (typeEl) typeEl.value = '';
                if (styleEl) styleEl.value = 'short';
            } else if (mode === 'berlin') {
                lettersEl.value = pick(['BE', 'TY', 'BL', 'NK', 'KB', 'SP', 'CH']);
                numbersEl.value = pick([yr, '30', '36', '44', '61', '100', '361']);
                if (typeEl) typeEl.value = '';
                if (styleEl) styleEl.value = 'std';
            } else if (mode === 'elektro') {
                lettersEl.value = pick(['EL', 'EQ', 'EV', 'TY', 'GO']);
                numbersEl.value = pick(['100', '500', yr, '800', '77']);
                if (typeEl) typeEl.value = 'E';
                if (styleEl) styleEl.value = 'carbon';
            } else {
                const alphabet = 'ABCDEFGHJKLMNPRSTUVWXYZ';
                const l1 = alphabet[Math.floor(Math.random() * alphabet.length)];
                const l2 = alphabet[Math.floor(Math.random() * alphabet.length)];
                lettersEl.value = l1 + l2;
                numbersEl.value = String(Math.floor(100 + Math.random() * 8900));
                if (typeEl) typeEl.value = '';
            }
            window.updateLivePlatePreview();
            window.showToast(`Kennzeichen-Idee "B - ${lettersEl.value} ${numbersEl.value}" geladen!`, 'success');
        };

        // =========================================================================
        // TAGES-AGENDA DRUCKEN & WEB-AUDIO SIGNALTON FÜR ADMIN
        // =========================================================================
        window.adminSoundEnabled = localStorage.getItem('red_admin_sound') !== 'false';

        window.toggleAdminSoundAlert = function() {
            window.adminSoundEnabled = !window.adminSoundEnabled;
            localStorage.setItem('red_admin_sound', window.adminSoundEnabled ? 'true' : 'false');
            const btn = document.getElementById('adminSoundToggleBtn');
            if (btn) {
                btn.style.color = window.adminSoundEnabled ? 'var(--green-accent)' : 'var(--text-muted)';
                btn.innerHTML = window.adminSoundEnabled
                    ? '<i class="fa-solid fa-volume-high"></i> Ton: An'
                    : '<i class="fa-solid fa-volume-xmark"></i> Ton: Aus';
            }
            if (window.adminSoundEnabled) window.playAdminNotificationSound();
            window.showToast(window.adminSoundEnabled ? '🔊 Signalton für neue Buchungen aktiviert' : '🔇 Signalton stummgeschaltet', 'success');
        };

        window.playAdminNotificationSound = function() {
            if (!window.adminSoundEnabled) return;
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.46);
            } catch (e) {}
        };

        window.printTodayAgenda = function() {
            const apts = window.redApts || [];
            const todayStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const todayAlt = new Date().toLocaleDateString('de-DE');

            const relevantApts = apts.filter(a => a.date === todayStr || a.date === todayAlt || Number(a.orderStatus) !== 4);
            const win = window.open('', '_blank');
            if (!win) {
                window.showToast('Bitte Pop-ups für die Druckansicht erlauben.', 'error');
                return;
            }

            let rowsHtml = '';
            if (relevantApts.length === 0) {
                rowsHtml = `<tr><td colspan="6" style="text-align:center; padding:18px;">Keine offenen Termine für heute eingetragen.</td></tr>`;
            } else {
                relevantApts.forEach((a, idx) => {
                    const stepMap = { 1: '1. Erfasst', 2: '2. Beim LABO', 3: '3. Schilder geprägt', 4: '4. Erledigt' };
                    rowsHtml += `
                        <tr>
                            <td>${idx + 1}</td>
                            <td><strong>${window.escHtml(a.date)}</strong><br>${window.escHtml(a.timeLabel || '')}${a.trackingCode ? '<br><small style="color:#d90000;font-weight:bold;">Code: ' + window.escHtml(a.trackingCode) + '</small>' : ''}</td>
                            <td><strong>${window.escHtml(a.name)}</strong><br><small>${window.escHtml(a.category || 'Privatkunde')}</small></td>
                            <td>${window.escHtml(a.phone || '-')}</td>
                            <td><strong>${window.escHtml(a.service)}</strong>${a.wunschkennzeichen ? '<br><small style="color:#0055cc;font-weight:bold;">Kennz.: ' + window.escHtml(a.wunschkennzeichen) + '</small>' : ''}${a.customNote ? '<br><small>' + window.escHtml(a.customNote) + '</small>' : ''}</td>
                            <td>${stepMap[Number(a.orderStatus) || 1]}</td>
                        </tr>
                    `;
                });
            }

            win.document.write(`
                <!DOCTYPE html>
                <html lang="de">
                <head>
                    <meta charset="UTF-8">
                    <title>Tages-Agenda ${todayStr} - RED Zulassungsdienst Berlin</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 25px; color: #111; font-size: 12px; }
                        h1 { color: #d90000; font-size: 18px; margin: 0 0 4px; text-transform: uppercase; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid #bbb; padding: 8px 10px; text-align: left; vertical-align: top; }
                        th { background: #f2f2f7; font-weight: bold; text-transform: uppercase; font-size: 10.5px; }
                        .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d90000; padding-bottom: 10px; }
                        .print-btn { background: #d90000; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
                        @media print { .print-btn { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="top-bar">
                        <div>
                            <h1>Tages-Agenda & Offene Aufträge (${todayStr})</h1>
                            <small>RED Zulassungsdienst Berlin • Inh. Tamer Yazici • Kienitzer Str. 6, 12053 Berlin</small>
                        </div>
                        <button class="print-btn" onclick="window.print()">🖨️ Jetzt ausdrucken</button>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Datum / Uhrzeit</th>
                                <th>Kunde / Art</th>
                                <th>Telefon</th>
                                <th>Leistung / Wunschkennzeichen</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
                </html>
            `);
            win.document.close();
        };

        // =========================================================================
        // AUTOMATISCHER JAHRESWECHSEL (2026 -> 2027+ AUTOPILOT & 3D-ANIMATION)
        // =========================================================================
        window.getDynamicSystemYear = function() {
            return new Date().getFullYear();
        };

        window.initAutomaticYearSystem = function() {
            const currentYear = window.getDynamicSystemYear();
            const now = new Date();
            const nextOrCurrentYear = (now.getMonth() === 11 && currentYear === 2026) ? 2027 : (currentYear > 2026 ? currentYear : 2027);
            const finalActiveYear = currentYear > 2026 ? currentYear : 2026;
            const shortYear = String(finalActiveYear).slice(-2);

            const introBadge = document.getElementById('introYearBadge');
            if (introBadge) {
                introBadge.innerText = '2026';
                setTimeout(() => {
                    introBadge.classList.add('flipping');
                    setTimeout(() => {
                        introBadge.innerText = String(nextOrCurrentYear);
                    }, 310);
                    if (currentYear === 2026 && now.getMonth() < 11) {
                        setTimeout(() => {
                            introBadge.classList.remove('flipping');
                            void introBadge.offsetWidth;
                            introBadge.classList.add('flipping');
                            setTimeout(() => {
                                introBadge.innerText = '2026';
                            }, 310);
                        }, 950);
                    }
                }, 850);
            }

            const huStamp = document.getElementById('livePlateHuStamp');
            if (huStamp) huStamp.innerText = shortYear;

            const wkNum = document.getElementById('wkNumbers');
            const prevNum = document.getElementById('platePreviewNumbers');
            if (wkNum && wkNum.value === '2026' && currentYear !== 2026) {
                wkNum.value = String(currentYear);
                if (prevNum) prevNum.innerText = String(currentYear);
            }

            const footerEl = document.getElementById('txt-footer-text');
            if (footerEl && currentYear > 2026) {
                footerEl.innerText = footerEl.innerText.replace('2026', String(currentYear));
            }
        };

        window.initFloatingPlates = function() {};

        // =========================================================================
        // LABO-COUNTDOWN, KOMPASS, BEZIRKE & FORMULAR-DRUCK
        // =========================================================================

        window.updateDispatchCountdown = function() {
            const el = document.getElementById('liveDispatchCountdown');
            if (!el) return;
            const bn = window.getBerlinNowParts();
            const todayHoliday = window.isBerlinHolidayYMD(bn.year, bn.month, bn.day);
            const day = bn.dayNum;
            const h = bn.h;
            const m = bn.m;

            if (day === 0 || day === 6 || todayHoliday || h >= 18) {
                el.innerHTML = `<strong style="display:block; color:var(--text-light); margin-bottom:2px;"><i class="fa-regular fa-clock" style="color:var(--primary-red); margin-right:5px;"></i>Express-Kontingent${todayHoliday ? ` (${todayHoliday})` : ''}</strong>Jetzt Online-Termin für den nächsten Werktag <span class="nowrap-unit">ab 09:00&nbsp;Uhr</span> sichern.`;
                return;
            }

            let targetH = h < 11 ? 11 : 16;
            let targetM = h < 11 ? 30 : 0;
            let diffMins = ((targetH * 60) + targetM) - ((h * 60) + m);
            if (diffMins <= 0) diffMins = ((18 * 60) - ((h * 60) + m));

            const remH = Math.floor(diffMins / 60);
            const remM = diffMins % 60;
            el.innerHTML = `<strong style="display:block; color:var(--text-light); margin-bottom:2px;"><i class="fa-solid fa-bolt" style="color:var(--primary-red); margin-right:5px;"></i>Nächste Behörden-Abgabe <span class="paren-inline">(LABO&nbsp;Berlin)</span></strong>In <span class="nowrap-unit" style="color:var(--primary-red); font-weight:900;">${remH}&nbsp;Std. ${remM}&nbsp;Min.</span> – jetzt Unterlagen einreichen.`;
        };
        setInterval(() => { if (!document.hidden) window.updateDispatchCountdown(); }, 30000);

        const compassData = {
            "privat": {
                title: "Privatperson: An-, Um- oder Neuanmeldung",
                desc: "Für die reguläre Neuzulassung, Umschreibung (Halterwechsel) oder Wiederzulassung eines Fahrzeugs auf eine Privatperson in Berlin:",
                docs: [
                    "Zulassungsbescheinigung Teil I (Fahrzeugschein) & Teil II (Fahrzeugbrief) im Original",
                    "Gültiger Personalausweis oder Reisepass mit aktueller Meldebescheinigung",
                    "Elektronische Versicherungsbestätigung (7-stellige eVB-Nummer)",
                    "Nachweis über gültige Hauptuntersuchung (TÜV / HU-Bericht im Original)",
                    "Unterschriebene Vollmacht & SEPA-Lastschriftmandat für die Kfz-Steuer (IBAN)",
                    "Bei zugelassenem Fahrzeug / Kennzeichenwechsel: Bisherige Kennzeichenschilder"
                ]
            },
            "gewerbe": {
                title: "Gewerbe / Firma / GmbH / UG",
                desc: "Für die Zulassung von Firmenfahrzeugen auf ein Unternehmen mit Sitz oder Niederlassung in Berlin:",
                docs: [
                    "Gewerbeanmeldung und aktueller Handelsregisterauszug (bei GmbH / UG / AG)",
                    "Original-Ausweis oder Reisepass des Geschäftsführers / Inhabers",
                    "Zulassungsbescheinigung Teil I & Teil II (Schein & Brief im Original)",
                    "7-stellige eVB-Nummer & gültiger TÜV / HU-Prüfbericht",
                    "SEPA-Lastschriftmandat des Firmenkontos (IBAN) für die Kfz-Steuer",
                    "Unterschriebene Vollmacht (mit Firmenstempel) & ggf. bisherige Schilder"
                ]
            },
            "kurzzeit": {
                title: "Kurzzeitkennzeichen (6 Tage für Überführung & Probefahrt)",
                desc: "Zur sofortigen Überführung von abgemeldeten Fahrzeugen oder für Fahrten zur Prüfstelle:",
                docs: [
                    "Gültiger Personalausweis oder Reisepass mit Meldebescheinigung (oder Gewerbenachweis)",
                    "Spezielle 7-stellige eVB-Nummer für Kurzzeitkennzeichen",
                    "Zulassungsbescheinigung Teil I & II (Original oder gut lesbare Kopie)",
                    "Nachweis einer gültigen Hauptuntersuchung (HU / TÜV)",
                    "Unterschriebene Vollmacht für den RED Zulassungsdienst Berlin"
                ]
            },
            "zoll": {
                title: "Zoll- / Ausfuhrkennzeichen (Internationaler Export)",
                desc: "Für den Export von Fahrzeugen ins Ausland (gültig wahlweise für 15 oder 30 Tage inkl. Versicherung):",
                docs: [
                    "Gültiger Reisepass oder Personalausweis mit Meldebescheinigung (Original)",
                    "Zulassungsbescheinigung Teil I (Schein) & Teil II (Brief) im Original",
                    "Gültiger HU / TÜV-Bericht für die gesamte Dauer des Ausfuhrkennzeichens",
                    "Gelbe internationale Versicherungsbestätigung für Ausfuhrkennzeichen",
                    "SEPA-Mandat / Kurzzeit-Steuerabrechnung & bisherige Kennzeichenschilder",
                    "Wichtig: Fahrzeug-Ident-Nr. (FIN) wird geprüft – wir beraten Sie vorab!"
                ]
            },
            "import": {
                title: "EU- oder Auslands-Import (Zulassung in Deutschland)",
                desc: "Für Fahrzeuge, die aus der EU oder einem Drittland importiert und in Berlin zugelassen werden sollen:",
                docs: [
                    "Original ausländische Fahrzeugpapiere & ggf. ausländische Kennzeichenschilder",
                    "EG-Übereinstimmungsbescheinigung (COC-Papier im Original) oder Vollgutachten nach § 21 StVZO",
                    "Kaufvertrag oder Original-Rechnung (Eigentumsnachweis)",
                    "Bei Import außerhalb der EU: Zoll-Unbedenklichkeitsbescheinigung im Original",
                    "Deutscher HU/AU-Bericht, 7-stellige eVB-Nummer, Ausweis, Vollmacht & SEPA-Mandat"
                ]
            },
            "abmeldung": {
                title: "Außerbetriebsetzung / Abmeldung (Sofort-Stilllegung)",
                desc: "Für die schnelle und rechtssichere Abmeldung Ihres Fahrzeugs (Steuer & Versicherung enden sofort):",
                docs: [
                    "Zulassungsbescheinigung Teil I (Fahrzeugschein im Original)",
                    "Beide bisherigen Kennzeichenschilder (zur Entstempelung)",
                    "Hinweis: Es wird weder Ihr Personalausweis noch eine Vollmacht benötigt!"
                ]
            },
            "verlust": {
                title: "Ersatzdokumente bei Verlust (Schein, Brief oder Kennzeichen)",
                desc: "Wenn Fahrzeugpapiere oder Schilder verloren gegangen oder gestohlen worden sind:",
                docs: [
                    "Gültiger Personalausweis oder Reisepass des eingetragenen Fahrzeughalters",
                    "Bei Verlust Fahrzeugschein (ZB I): Fahrzeugbrief (ZB II) + gültiger TÜV-Bericht",
                    "Bei Verlust Fahrzeugbrief (ZB II): Fahrzeugschein (ZB I) + Versicherung an Eides statt",
                    "Bei Diebstahl von Kennzeichen: Polizeiliche Diebstahlsanzeige + Schein & Brief + TÜV",
                    "Unterschriebene Vollmacht & Verlusterklärung (direkt über Digitale Vollmacht erstellbar)"
                ]
            }
        };

        window.updateCompassProgress = function() {
            const listEl = document.getElementById('compassDocList');
            const badge = document.getElementById('compassProgressBadge');
            if (!listEl || !badge) return;
            const total = listEl.querySelectorAll('li').length;
            const checked = listEl.querySelectorAll('li[data-checked="1"]').length;
            if (total > 0 && checked === total) {
                badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Alle ${total} bereit!`;
                badge.style.background = 'var(--green-bg-soft)';
                badge.style.borderColor = 'var(--green-border)';
                badge.style.color = 'var(--green-accent)';
            } else {
                badge.innerText = `${checked} / ${total} abgehakt`;
                badge.style.background = 'var(--bg-card)';
                badge.style.borderColor = 'var(--glass-border)';
                badge.style.color = 'var(--text-muted)';
            }
        };

        window.toggleCompassDocItem = function(liEl) {
            if (!liEl) return;
            const isChecked = liEl.getAttribute('data-checked') === '1';
            const nextState = !isChecked;
            liEl.setAttribute('data-checked', nextState ? '1' : '0');
            liEl.style.opacity = nextState ? '0.78' : '1';
            liEl.style.borderColor = nextState ? 'var(--green-border)' : 'var(--glass-border)';
            liEl.style.background = nextState ? 'var(--green-bg-soft)' : 'var(--bg-card)';
            const icon = liEl.querySelector('i');
            const span = liEl.querySelector('span');
            if (icon) {
                icon.className = nextState ? 'fa-solid fa-square-check' : 'fa-regular fa-square';
                icon.style.color = nextState ? 'var(--green-accent)' : 'var(--primary-red)';
            }
            if (span) {
                span.style.textDecoration = nextState ? 'line-through' : 'none';
            }
            window.updateCompassProgress();
        };

        window.selectCompassCase = function(caseKey, btnEl) {
            document.querySelectorAll('.compass-tab-btn').forEach(b => b.classList.remove('active'));
            if (btnEl) btnEl.classList.add('active');

            const data = compassData[caseKey];
            if (!data) return;

            document.getElementById('compassCaseTitle').innerText = data.title;
            document.getElementById('compassCaseDesc').innerText = data.desc + ' (Einfach zum Abhaken antippen)';

            const listEl = document.getElementById('compassDocList');
            listEl.innerHTML = '';
            data.docs.forEach(docText => {
                const li = document.createElement('li');
                li.setAttribute('data-checked', '0');
                li.style.cssText = 'cursor:pointer; user-select:none; padding:9px 11px; border-radius:10px; border:1px solid var(--glass-border); background:var(--bg-card); transition:all 0.18s ease; margin-bottom:7px; display:flex; align-items:flex-start; gap:9px;';
                li.onclick = () => window.toggleCompassDocItem(li);
                li.innerHTML = `<i class="fa-regular fa-square" style="color:var(--primary-red); font-size:15px; margin-top:2px; flex-shrink:0;"></i> <span>${docText}</span>`;
                listEl.appendChild(li);
            });
            window.updateCompassProgress();
        };

        document.addEventListener('DOMContentLoaded', () => {
            const firstTab = document.querySelector('#compassTabsContainer .compass-tab-btn');
            if (document.getElementById('compassDocList')) {
                window.selectCompassCase('privat', firstTab);
            }
        });

        window.applyCompassToBooking = function() {
            const title = document.getElementById('compassCaseTitle').innerText;
            window.selectedServiceVal = `Zulassung (${title.split(':')[0] || 'Beratung'})`;
            document.getElementById('selectTriggerText').innerText = window.selectedServiceVal;
            window.updateBookingLiveSummary();
            document.getElementById('termin').scrollIntoView({ behavior: 'smooth' });
            window.showToast('Fall in das Buchungsformular übernommen!', 'success');
        };

        const plateGuideDetails = {
            "euro": `<strong style="display:block;"><i class="fa-solid fa-id-card" style="color:var(--primary-red); margin-right:5px;"></i>Euro-Standardkennzeichen</strong><span class="paren-sub">(520 × 110 mm)</span>Das offizielle Standardmaß für alle regulären PKW & LKW in Berlin. Sofortprägung bei uns vor Ort in hochwertiger Alu- oder 3D-Carbon-Optik inklusive grüner Umweltplakette.`,
            "kurz": `<strong style="display:block;"><i class="fa-solid fa-ruler-horizontal" style="color:var(--primary-red); margin-right:5px;"></i>Kurzes Berliner Kennzeichen</strong><span class="paren-sub">(460 mm oder 420 × 110 mm)</span>Besonders beliebt für sportliche Optik bei kurzen Zeichenkombinationen <span class="paren-inline">(z.B. B - TY 1)</span>. Wir haben alle kurzen Rohlinge direkt vorrätig.`,
            "elektro": `<strong style="display:block;"><i class="fa-solid fa-bolt" style="color:var(--green-accent); margin-right:5px;"></i>E-Kennzeichen</strong><span class="paren-sub">(Elektro & Plug-In Hybrid)</span>Mit dem Zusatzbuchstaben „E“ am Ende profitieren Sie von Steuervorteilen und Bevorrechtigungen im Straßenverkehr. Sofort bei uns prägbar.`,
            "oldtimer": `<strong style="display:block;"><i class="fa-solid fa-landmark" style="color:var(--primary-red); margin-right:5px;"></i>H-Kennzeichen</strong><span class="paren-sub">(Historische Oldtimer ab 30 Jahren)</span>Pauschalierter Kfz-Steuersatz und freie Fahrt in allen Umweltzonen ohne grüne Plakette <span class="paren-inline">(Gutachten nach § 23 StVZO erforderlich)</span>.`,
            "saison": `<strong style="display:block;"><i class="fa-solid fa-calendar-days" style="color:var(--primary-red); margin-right:5px;"></i>Saisonkennzeichen</strong><span class="paren-sub">(z.B. 04/10 oder 03/10)</span>Ideal für Cabrios, Motorräder, Wohnmobile & Sommerfahrzeuge – Sie zahlen Steuer & Versicherung nur für den gewählten Zulassungszeitraum.`,
            "kurzzeit": `<strong style="display:block;"><i class="fa-solid fa-stopwatch" style="color:var(--primary-red); margin-right:5px;"></i>Kurzzeitkennzeichen</strong><span class="paren-sub">(6 Tage mit gelbem Rand)</span>Perfekt für Probe-, Überführungs- und TÜV-Fahrten von abgemeldeten Fahrzeugen innerhalb Deutschlands. Sofort zum Mitnehmen.`,
            "zoll": `<strong style="display:block;"><i class="fa-solid fa-globe" style="color:var(--primary-red); margin-right:5px;"></i>Zoll- / Ausfuhrkennzeichen</strong><span class="paren-sub">(Roter Rand, 15–30 Tage)</span>Für den sicheren Export von Fahrzeugen ins EU- und Nicht-EU-Ausland inklusive internationaler gelber Versicherungskarte.`,
            "zweizeilig": `<strong style="display:block;"><i class="fa-solid fa-motorcycle" style="color:var(--primary-red); margin-right:5px;"></i>Motorrad- & Zweizeilige Schilder</strong><span class="paren-sub">(180×200 mm / 255×130 mm)</span>Offizielle Kraftrad-, Leichtkraftrad-, Quad- und US-Import-Kennzeichen sofort zum Mitnehmen vor Ort.`
        };

        window.selectPlateGuide = function(key, btnEl) {
            const parent = btnEl.parentElement;
            if(parent) parent.querySelectorAll('.district-pill').forEach(p => p.classList.remove('active'));
            btnEl.classList.add('active');
            const infoEl = document.getElementById('plateGuideInfoText');
            if(infoEl && plateGuideDetails[key]) {
                infoEl.innerHTML = plateGuideDetails[key];
            }
        };

        const districtDetails = {
            "neukoelln": "Direkt vor Ort in Neukölln / Britz (Kienitzer Str. 6, 12053 Berlin): Nur 2–8 Minuten Fahrzeit (U7 Karl-Marx-Straße / U8 Boddinstraße / Hermannplatz / Stadtautobahn A100 Ausfahrt Britzer Damm). Sofort-Annahme ohne Wartezeit!",
            "kreuzberg": "Ab Kreuzberg / Mitte: Nur ca. 8–12 Minuten über Hermannplatz, Kottbusser Damm oder Urbanstraße direkt zu unserer Annahmestelle in der Kienitzer Str. 6.",
            "tempelhof": "Ab Tempelhof-Schöneberg: Über den Tempelhofer Damm / Columbiadamm oder die A100 (Ausfahrt Tempelhofer Damm / Britzer Damm) in nur ca. 8–10 Minuten direkt vor Ort.",
            "charlottenburg": "Ab Charlottenburg-Wilmersdorf: Direkt über die Stadtautobahn A100 bis Ausfahrt Britzer Damm / Hermannstraße – Ihre Dokumente sind in 5 Minuten abgegeben!",
            "spandau": "Ab Spandau: Schnelle Verbindung über den Stadtring A100 Richtung Neukölln (Ausfahrt Britzer Damm) oder mit der U7/U8. Tipp: Nutzen Sie vorab unseren kostenlosen WhatsApp-Foto-Check!",
            "reinickendorf": "Ab Tegel / Reinickendorf: Direkte U-Bahn-Linie U8 (ohne Umsteigen bis Station Boddinstraße direkt an der Kienitzer Str.) oder schnell über die A111 / A100!",
            "wedding": "Ab Wedding / Gesundbrunnen: Mit der U8 ab Osloer Str. / Gesundbrunnen in nur ca. 16 Minuten direkt bis U-Bhf Boddinstraße (Kienitzer Str. 6) – völlig staufrei!",
            "pankow": "Ab Pankow / Weißensee: Über die B96a / Ringbahn (S41/S42 bis Hermannstraße) oder U8 direkt zu uns. Auf Wunsch prüfen wir alle Papiere vorab per Foto!",
            "marzahn": "Ab Marzahn-Hellersdorf: Bequem über die B1/B5, Rhinstraße oder S-Bahn bis Ostkreuz/Ringbahn Richtung Neukölln. Wir erledigen Ihre Zulassung ohne langen Behörden-Stau!",
            "lichtenberg": "Ab Friedrichshain / Lichtenberg: Über die Elsenbrücke / Treptower Park oder Ringbahn in ca. 12–15 Minuten direkt bei uns in der Kienitzer Str. 6.",
            "treptow": "Ab Treptow-Köpenick: Schnell über die Sonnenallee, Baumschulenweg oder A113/A100 (Ausfahrt Grenzallee / Britzer Damm) in wenigen Minuten erreichbar!",
            "steglitz": "Ab Steglitz-Zehlendorf: Über die A103 / A100 bis Britzer Damm in ca. 14 Minuten direkt vor unsere Tür – Sofortkennzeichen direkt zum Mitnehmen!"
        };

        window.selectBerlinDistrict = function(districtKey, btnEl) {
            const parent = btnEl.parentElement;
            if(parent) parent.querySelectorAll('.district-pill').forEach(p => p.classList.remove('active'));
            if(btnEl) btnEl.classList.add('active');
            const box = document.getElementById('districtResultBox');
            if(box && districtDetails[districtKey]) {
                box.innerHTML = `<strong style="color:var(--primary-red);"><i class="fa-solid fa-route"></i> Express-Anbindung (${btnEl.innerText.replace('📍 ','')}):</strong><span style="color:var(--text-light);">${districtDetails[districtKey]}</span>`;
            }
        };

        window.switchOnlineToolTab = function(tabKey, btnEl) {
            document.querySelectorAll('.tools-tab-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-tool-tab') === tabKey);
            });
            document.querySelectorAll('.tool-tab-pane').forEach(p => {
                p.classList.toggle('active', p.id === 'tool-pane-' + tabKey);
            });
        };

        window.updateLivePlatePreview = function() {
            const lettersInput = document.getElementById('wkLetters');
            const numbersInput = document.getElementById('wkNumbers');
            const typeSelect = document.getElementById('wkType');
            const seasonSelect = document.getElementById('wkSeason');
            const styleSelect = document.getElementById('wkStyle');
            const plateBox = document.getElementById('liveGermanPlatePreview');
            const seasonBox = document.getElementById('plateSeasonBox');
            if(!lettersInput || !numbersInput) return;

            const cleanLetters = lettersInput.value.replace(/[^a-zA-ZäöüÄÖÜ]/g, '').toUpperCase().substring(0, 2);
            const cleanNumbers = numbersInput.value.replace(/\D/g, '').substring(0, 4);
            lettersInput.value = cleanLetters;
            numbersInput.value = cleanNumbers;

            document.getElementById('platePreviewLetters').innerText = cleanLetters || 'RED';
            document.getElementById('platePreviewNumbers').innerText = cleanNumbers || String(window.getDynamicSystemYear());
            document.getElementById('platePreviewSuffix').innerText = typeSelect ? typeSelect.value : '';

            if(seasonSelect && seasonBox) {
                if(seasonSelect.value) {
                    const parts = seasonSelect.value.split('/');
                    document.getElementById('seasonStartTxt').innerText = parts[0] || '04';
                    document.getElementById('seasonEndTxt').innerText = parts[1] || '10';
                    seasonBox.style.display = 'flex';
                } else {
                    seasonBox.style.display = 'none';
                }
            }

            if(plateBox && styleSelect) {
                plateBox.classList.remove('plate-short', 'plate-carbon');
                if(styleSelect.value === 'short') plateBox.classList.add('plate-short');
                if(styleSelect.value === 'carbon') plateBox.classList.add('plate-carbon');
            }
        };

        window.buildCurrentStudioPlate = function() {
            window.updateLivePlatePreview();
            const l = (document.getElementById('wkLetters')?.value || document.getElementById('platePreviewLetters')?.innerText || 'TY').trim().toUpperCase();
            const n = (document.getElementById('wkNumbers')?.value || document.getElementById('platePreviewNumbers')?.innerText || String(window.getDynamicSystemYear())).trim();
            const s = (document.getElementById('wkType')?.value || '').trim();
            const season = document.getElementById('wkSeason')?.value || '';
            const style = document.getElementById('wkStyle')?.value || 'std';
            const styleLabel = style === 'carbon' ? ' [3D-Carbon]' : (style === 'short' ? ' [Kurzes Schild]' : '');
            return `B - ${l} ${n}${s ? ' ' + s : ''}${season ? ' (Saison ' + season + ')' : ''}${styleLabel}`;
        };

        window.applyPlateToBooking = function(shouldScroll = true) {
            const fullPlate = window.buildCurrentStudioPlate();
            if (typeof window.switchView === 'function' && document.querySelector('.view-section.active')?.id !== 'view-home') {
                window.switchView('view-home');
            }
            const plateInput = document.getElementById('formWunschkennzeichen');
            if (plateInput) {
                plateInput.value = fullPlate;
                plateInput.style.borderColor = 'var(--green-border)';
                plateInput.style.boxShadow = '0 0 0 3px rgba(18, 140, 65, 0.28)';
                setTimeout(() => { plateInput.style.borderColor = ''; plateInput.style.boxShadow = ''; }, 2800);
            }
            try { sessionStorage.setItem('red_pending_plate', fullPlate); } catch (e) {}
            window.updateBookingLiveSummary();
            if (shouldScroll) {
                setTimeout(() => {
                    const terminEl = document.getElementById('termin');
                    if (terminEl) terminEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 60);
            }
            window.showToast(`Wunschkennzeichen „${fullPlate}“ direkt für den Termin übernommen!`, 'success');
        };

        window.selectedClientCategory = 'Privatkunde';

        window.selectBookingClientType = function(typeStr, el) {
            window.selectedClientCategory = typeStr;
            document.querySelectorAll('#bookingCustomerTypePills .booking-type-pill').forEach(p => p.classList.remove('active'));
            if(el) el.classList.add('active');
            window.updateBookingLiveSummary();
        };

        window.getOrCreatePendingTrackingCode = function(forceNew = false) {
            if (forceNew || !window.pendingTrackingCode || !/^RED-\d{6}$/.test(window.pendingTrackingCode)) {
                window.pendingTrackingCode = 'RED-' + Math.floor(100000 + Math.random() * 900000);
            }
            const badge = document.getElementById('summaryTrackingCodeBadge');
            if (badge) badge.innerText = window.pendingTrackingCode;
            return window.pendingTrackingCode;
        };

        window.copyCurrentTrackingCode = function() {
            const code = (window.lastBookedApt && window.lastBookedApt.trackingCode)
                || document.getElementById('confirmTrackingCodeVal')?.innerText
                || window.getOrCreatePendingTrackingCode(false);
            if (!code) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(code).then(() => {
                    window.showToast(`Auftrags-Code ${code} kopiert!`, 'success');
                }).catch(() => {
                    window.showToast(`Bitte manuell notieren: ${code}`, 'success');
                });
            } else {
                window.showToast(`Bitte manuell notieren: ${code}`, 'success');
            }
        };

        window.updateBookingLiveSummary = function() {
            const srvTextEl = document.getElementById('summaryServiceText');
            const dtTextEl = document.getElementById('summaryDateTimeText');
            window.getOrCreatePendingTrackingCode(false);
            if(!srvTextEl || !dtTextEl) return;

            const cat = window.selectedClientCategory || 'Privatkunde';
            const srv = window.selectedServiceVal || 'Anmeldung';
            const plateVal = document.getElementById('formWunschkennzeichen')?.value.trim().toUpperCase() || '';
            const note = document.getElementById('formCustomNote')?.value.trim() || '';
            srvTextEl.innerText = `${cat} • ${srv}${plateVal ? ' • Kennz.: ' + plateVal : ''}${note ? ' (' + note + ')' : ''}`;

            const d = document.getElementById('datePicker')?.value || '';
            const t = window.chosenHour ? (window.chosenHour.includes('Uhr') ? window.chosenHour : window.chosenHour + ' Uhr') : '';
            if(d && t) {
                dtTextEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--green-accent);"></i> ${d} um ${t}`;
            } else if(d) {
                dtTextEl.innerText = `${d} (Bitte noch Uhrzeit wählen)`;
            } else {
                dtTextEl.innerText = 'Bitte Datum & Uhrzeit wählen';
            }
        };
        document.addEventListener('DOMContentLoaded', () => window.getOrCreatePendingTrackingCode(false));

        window.sendLastBookingViaWhatsApp = function() {
            const apt = window.lastBookedApt;
            if(!apt) return;
            let waPhone = (window.dynamicContactData?.phone || '01783783875').replace(/\D/g, '');
            if (waPhone.startsWith('0')) waPhone = '49' + waPhone.substring(1);
            const msg = encodeURIComponent(`📅 *NEUE TERMIN-RESERVIERUNG (RED BERLIN)*\n\n• *Auftrags-Code:* ${apt.trackingCode || '-'}\n• *Kunde:* ${apt.name} (${apt.category || 'Privatkunde'})\n• *Datum & Zeit:* ${apt.date} um ${apt.time}\n• *Anliegen:* ${apt.service}\n• *Wunschkennzeichen:* ${apt.wunschkennzeichen || '-'}\n• *Hinweis:* ${apt.customNote || '-'}\n• *Telefon:* ${apt.phone || '-'}`);
            window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
        };

        let sigCanvas = null, sigCtx = null, isDrawingSig = false, hasDrawnSig = false;

        window.initSignaturePad = function() {
            sigCanvas = document.getElementById('vollmachtSignatureCanvas');
            if (!sigCanvas) return;
            const rect = sigCanvas.parentElement.getBoundingClientRect();
            sigCanvas.width = rect.width || 500;
            sigCanvas.height = rect.height || 155;
            sigCtx = sigCanvas.getContext('2d');
            sigCtx.strokeStyle = '#001a66';
            sigCtx.lineWidth = 2.6;
            sigCtx.lineCap = 'round';
            sigCtx.lineJoin = 'round';

            const getPos = (e) => {
                const r = sigCanvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                return { x: clientX - r.left, y: clientY - r.top };
            };

            const startDraw = (e) => {
                e.preventDefault();
                isDrawingSig = true;
                hasDrawnSig = true;
                const pos = getPos(e);
                sigCtx.beginPath();
                sigCtx.moveTo(pos.x, pos.y);
            };
            const moveDraw = (e) => {
                if (!isDrawingSig) return;
                e.preventDefault();
                const pos = getPos(e);
                sigCtx.lineTo(pos.x, pos.y);
                sigCtx.stroke();
            };
            const endDraw = () => { isDrawingSig = false; };

            sigCanvas.onmousedown = startDraw;
            sigCanvas.onmousemove = moveDraw;
            if (!window._sigMouseUpBound) {
                window._sigMouseUpBound = true;
                window.addEventListener('mouseup', () => { isDrawingSig = false; });
            }
            sigCanvas.ontouchstart = startDraw;
            sigCanvas.ontouchmove = moveDraw;
            sigCanvas.ontouchend = endDraw;
        };

        window.openDigitalVollmachtModal = function(presetTitle) {
            const sel = document.getElementById('dvDocType');
            if (sel && presetTitle) {
                for (let i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value.toLowerCase().includes(presetTitle.toLowerCase().substring(0, 10))) {
                        sel.selectedIndex = i;
                        break;
                    }
                }
            }
            document.getElementById('digitalVollmachtOverlay').classList.add('open');
            setTimeout(() => window.initSignaturePad(), 150);
        };

        window.closeDigitalVollmachtModal = function() {
            document.getElementById('digitalVollmachtOverlay').classList.remove('open');
        };

        window.toggleDvExtraFields = function() {};

        window.clearVollmachtSignature = function() {
            if (!sigCanvas || !sigCtx) return;
            sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
            hasDrawnSig = false;
        };

        window.printDigitalVollmacht = function() {
            const esc = window.escHtml;
            const docType = esc(document.getElementById('dvDocType')?.value || 'Allgemeine Vollmacht & SEPA-Mandat');
            const actionType = esc(document.getElementById('dvActionType')?.value || 'Neuzulassung / Anmeldung');
            const name = esc(document.getElementById('dvName')?.value.trim() || '__________________________________________________');
            const birth = esc(document.getElementById('dvBirth')?.value.trim() || '____________________________________');
            const addr = esc(document.getElementById('dvAddress')?.value.trim() || '____________________________________________________________');
            const idNum = esc(document.getElementById('dvIdNumber')?.value.trim() || '____________________________________');
            const veh = esc(document.getElementById('dvVehicle')?.value.trim() || '____________________________________________________________');
            const evb = esc(document.getElementById('dvEvb')?.value.trim() || '____________________________________________________________');
            const iban = esc(document.getElementById('dvIban')?.value.trim() || 'DE____ | ______ | ______ | ______ | ______ | ____');
            const accOwner = esc(document.getElementById('dvAccountOwner')?.value.trim() || '__________________________________________________');
            const sigDataUrl = (sigCanvas && hasDrawnSig) ? sigCanvas.toDataURL('image/png') : '';
            const todayStr = new Date().toLocaleDateString('de-DE');

            let legalBodyText = `<p><strong>1. Vollmacht zur Vorlage bei der Kfz-Zulassungsbehörde (LABO Berlin / Brandenburg):</strong><br>Hiermit bevollmächtige ich den <strong>RED Zulassungsdienst Berlin (Inhaber: Tamer Yazici und Beauftragte, Kienitzer Str. 6, 12053 Berlin)</strong>, das unten bezeichnete Fahrzeug auf meinen Namen / unsere Firma zuzulassen, umzuschreiben oder abzumelden (Vorgang: <strong>${actionType}</strong>) sowie die Fahrzeugpapiere und Kennzeichenschilder entgegenzunehmen.</p>
            <p style="font-size:12px;"><strong>2. Einverständniserklärung (Steuer- & Gebührenrückstände):</strong><br>Ich erkläre mein ausdrückliches Einverständnis, dass dem Bevollmächtigten mitgeteilt wird, ob Kraftfahrzeugsteuerrückstände oder rückständige Gebühren und Auslagen aus vorangegangenen Zulassungsvorgängen bestehen.</p>`;

            if (docType.includes('Verlusterklärung')) {
                legalBodyText += `<p style="font-size:12px; border:1px solid #111; padding:10px; background:#fff8f8;"><strong>Versicherung an Eides statt bei Verlust (§ 5 FZV / §§ 156, 161 StGB):</strong><br>Ich erkläre hiermit an Eides statt, dass das Fahrzeugdokument / Kennzeichenschild ([ &nbsp; ] ZB Teil I Schein &nbsp; [ &nbsp; ] ZB Teil II Brief &nbsp; [ &nbsp; ] Amtliches Kennzeichen) unauffindbar verloren gegangen ist und nicht verpfändet oder hinterlegt wurde.</p>`;
            }

            const printWin = window.open('', '_blank');
            if (!printWin) {
                window.showToast('Bitte Pop-ups erlauben, um das Dokument zu öffnen.', 'error');
                return;
            }
            printWin.document.write(`
                <!DOCTYPE html>
                <html lang="de">
                <head>
                    <meta charset="UTF-8">
                    <title>${docType} - RED Zulassungsdienst Berlin</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 30px; color: #111; line-height: 1.5; max-width: 780px; margin: 0 auto; font-size: 12.5px; }
                        .header { border-bottom: 3px solid #e60000; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
                        h1 { font-size: 19px; margin: 0; color: #e60000; text-transform: uppercase; }
                        .box { border: 1px solid #bbb; padding: 12px 15px; border-radius: 6px; margin-bottom: 14px; background: #fafafa; }
                        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
                        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 22px; }
                        .sig-box { border-bottom: 1.5px solid #000; min-height: 75px; display: flex; align-items: flex-end; padding-bottom: 4px; }
                        .no-print-bar { background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                        .no-print-btn { background: #e60000; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
                        @media print { .no-print-bar { display: none !important; } body { padding: 10px; } }
                    </style>
                </head>
                <body>
                    <div class="no-print-bar">
                        <span><strong>RED Dokumenten-Service:</strong> Ausgefüllt oder als Blanko-Vordruck druckbereit</span>
                        <button class="no-print-btn" onclick="window.print()">🖨️ Jetzt Drucken / Als PDF speichern</button>
                    </div>
                    <div class="header">
                        <div>
                            <h1>${docType}</h1>
                            <small>RED Zulassungsdienst Berlin • Inh. Tamer Yazici • Kienitzer Str. 6, 12053 Berlin • Tel: 0178 378 38 75</small>
                        </div>
                        <div style="font-weight:bold; font-size:12px;">Datum: ${todayStr}</div>
                    </div>
                    ${legalBodyText}
                    <div class="box">
                        <strong style="text-transform:uppercase; font-size:11px; color:#e60000;">3. Angaben zum Fahrzeughalter / Vollmachtgeber & Fahrzeug:</strong>
                        <div class="grid-2" style="margin-top:8px;">
                            <div>Name, Vorname / Firma:<br><strong>${name}</strong></div>
                            <div>Geburtsdatum & Geburtsort:<br><strong>${birth}</strong></div>
                            <div style="grid-column:1/-1;">Anschrift (Straße, Hausnr., PLZ, Ort):<br><strong>${addr}</strong></div>
                            <div>Ausweis- / Pass-Nr. / HRB:<br><strong>${idNum}</strong></div>
                            <div>Vorgangsart:<br><strong>${actionType}</strong></div>
                            <div>Fahrzeug (FIN / Marke & Modell):<br><strong>${veh}</strong></div>
                            <div>Kennzeichen / eVB-Versicherungs-Nr.:<br><strong>${evb}</strong></div>
                        </div>
                    </div>
                    <div class="box">
                        <strong style="text-transform:uppercase; font-size:11px; color:#e60000;">4. SEPA-Lastschriftmandat zum Einzug der Kraftfahrzeugsteuer (Bundeszollverwaltung):</strong>
                        <p style="font-size:11px; margin:6px 0;">Ich ermächtige die Bundeskasse, Zahlungen von meinem unten angegebenen Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die von der Bundeskasse auf mein Konto gezogenen Lastschriften einzulösen.</p>
                        <div class="grid-2" style="margin-top:8px;">
                            <div>IBAN des Kontoinhabers:<br><strong>${iban}</strong></div>
                            <div>Kontoinhaber & Kreditinstitut / BIC:<br><strong>${accOwner}</strong></div>
                        </div>
                    </div>
                    <div class="sig-grid">
                        <div>
                            <div class="sig-box">${sigDataUrl ? `<img src="${sigDataUrl}" style="max-height:70px;">` : ''}</div>
                            <small>Berlin, den ${todayStr} – <strong>Unterschrift Fahrzeughalter / Vollmachtgeber</strong></small>
                        </div>
                        <div>
                            <div class="sig-box">${sigDataUrl ? `<img src="${sigDataUrl}" style="max-height:70px;">` : ''}</div>
                            <small>Berlin, den ${todayStr} – <strong>Unterschrift Kontoinhaber (für SEPA-Kfz-Steuer)</strong></small>
                        </div>
                    </div>
                </body>
                </html>
            `);
            printWin.document.close();
        };

        window.openKaufvertragModal = function() {
            document.getElementById('kaufvertragOverlay').classList.add('open');
        };

        window.closeKaufvertragModal = function() {
            document.getElementById('kaufvertragOverlay').classList.remove('open');
        };

        window.printKaufvertrag = function() {
            const esc = window.escHtml;
            const seller = esc(document.getElementById('kvSeller')?.value.trim() || '____________________________________________________________');
            const sellerId = esc(document.getElementById('kvSellerId')?.value.trim() || '____________________________________');
            const buyer = esc(document.getElementById('kvBuyer')?.value.trim() || '____________________________________________________________');
            const buyerId = esc(document.getElementById('kvBuyerId')?.value.trim() || '____________________________________');
            const car = esc(document.getElementById('kvCar')?.value.trim() || '________________________________________');
            const vin = esc(document.getElementById('kvVin')?.value.trim() || '________________________________________');
            const km = esc(document.getElementById('kvKm')?.value.trim() || 'EZ: ____________ • KM-Stand: ________________ km');
            const plate = esc(document.getElementById('kvPlate')?.value.trim() || 'Kennz.: ______________ • HU/TÜV bis: ________');
            const keys = esc(document.getElementById('kvKeys')?.value.trim() || '____ Vorbesitzer • ____ Schlüssel');
            const accident = esc(document.getElementById('kvAccident')?.value.trim() || '[  ] Unfallfrei   [  ] Folgende Schäden: ________________________');
            const price = esc(document.getElementById('kvPrice')?.value.trim() || '________________________ € (in Worten: ____________________________________)');
            const handover = esc(document.getElementById('kvHandoverDate')?.value.trim() || 'Berlin, am ____.____.202__ um ____:____ Uhr');
            const notes = esc(document.getElementById('kvNotes')?.value.trim() || 'Das Fahrzeug wird – soweit gesetzlich zulässig – unter Ausschluss jeglicher Sachmängelhaftung verkauft.').replace(/\n/g, '<br>');
            const todayStr = new Date().toLocaleDateString('de-DE');

            const printWin = window.open('', '_blank');
            if (!printWin) {
                window.showToast('Bitte Pop-ups erlauben, um den Kaufvertrag zu öffnen.', 'error');
                return;
            }
            printWin.document.write(`
                <!DOCTYPE html>
                <html lang="de">
                <head>
                    <meta charset="UTF-8">
                    <title>Kfz-Kaufvertrag - RED Zulassungsdienst Berlin</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 28px; color: #111; line-height: 1.48; max-width: 800px; margin: 0 auto; font-size: 12px; }
                        .header { border-bottom: 3px solid #9a6500; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
                        h1 { font-size: 18px; margin: 0; color: #111; text-transform: uppercase; }
                        .box { border: 1px solid #bbb; padding: 10px 14px; border-radius: 6px; margin-bottom: 11px; background: #fafafa; }
                        .box h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #7a4f00; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
                        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
                        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 28px; }
                        .sig-line { border-top: 1.5px solid #000; padding-top: 5px; text-align: center; font-weight: bold; font-size: 11px; }
                        .no-print-bar { background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
                        .no-print-btn { background: #b38728; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
                        @media print { .no-print-bar { display: none !important; } body { padding: 8px; } }
                    </style>
                </head>
                <body>
                    <div class="no-print-bar">
                        <span><strong>RED Kfz-Kaufvertrag:</strong> Vollständige DIN-A4 Ausführung (Ausgefüllt & Blanko nutzbar)</span>
                        <button class="no-print-btn" onclick="window.print()">🖨️ Jetzt Drucken / Als PDF speichern</button>
                    </div>
                    <div class="header">
                        <div>
                            <h1>Kaufvertrag für ein gebrauchtes Kraftfahrzeug</h1>
                            <small>Bereitgestellt von RED Zulassungsdienst & Auto Ankauf Berlin • Kienitzer Str. 6, 12053 Berlin • Tel: 0178 378 38 75</small>
                        </div>
                        <div style="font-weight:bold;">Stand: ${todayStr}</div>
                    </div>
                    <div class="box">
                        <h4>1. Vertragspartner (Verkäufer & Käufer)</h4>
                        <div class="grid-2">
                            <div><strong>Verkäufer (Name, Anschrift, Tel.):</strong><br>${seller}</div>
                            <div><strong>Ausweis-/Pass-Nr. & Geburtsdatum (Verkäufer):</strong><br>${sellerId}</div>
                            <div><strong>Käufer (Name, Anschrift, Tel.):</strong><br>${buyer}</div>
                            <div><strong>Ausweis-/Pass-Nr. & Geburtsdatum (Käufer):</strong><br>${buyerId}</div>
                        </div>
                    </div>
                    <div class="box">
                        <h4>2. Fahrzeugbeschreibung & Technische Daten</h4>
                        <div class="grid-2">
                            <div><strong>Hersteller / Modell / Typ:</strong><br>${car}</div>
                            <div><strong>Fahrzeug-Ident-Nr. (FIN / 17-stellig):</strong><br>${vin}</div>
                            <div><strong>Erstzulassung & Laufleistung:</strong><br>${km}</div>
                            <div><strong>Letztes Kennzeichen & Nächste HU (TÜV):</strong><br>${plate}</div>
                            <div><strong>Vorbesitzer & Schlüsselanzahl:</strong><br>${keys}</div>
                            <div><strong>Unfallschäden / Vorschäden:</strong><br>${accident}</div>
                        </div>
                    </div>
                    <div class="box">
                        <h4>3. Kaufpreis, Übergabeprotokoll & Ausgehändigte Unterlagen</h4>
                        <div><strong>Gesamtkaufpreis:</strong> ${price}</div>
                        <div style="margin-top:6px;"><strong>Ort, Datum & genaue Uhrzeit der Fahrzeugübergabe:</strong> ${handover}</div>
                    </div>
                    <div class="box">
                        <h4>4. Sachmängelhaftung, Ummelde-Pflicht & Sondervereinbarungen</h4>
                        <div style="font-size:11.5px;">${notes}</div>
                    </div>
                    <div class="sig-grid">
                        <div class="sig-line">Ort, Datum & Unterschrift des Verkäufers</div>
                        <div class="sig-line">Ort, Datum & Unterschrift des Käufers</div>
                    </div>
                </body>
                </html>
            `);
            printWin.document.close();
        };

// =========================================================================

// =========================================================================
        // 8. WHATSAPP FOTO-VORABCHECK, VIRAL SHARE, TRACKER & KALKULATOR
        // =========================================================================
        window.startPhotoPreCheckWhatsApp = function(includeCompassStatus = false) {
            let waPhone = (window.dynamicContactData?.phone || '01783783875').replace(/\D/g, '');
            if (waPhone.startsWith('0')) waPhone = '49' + waPhone.substring(1);

            let text = 'Hallo RED-Team! 👋 Ich möchte meine Kfz-Papiere kurz vorab per WhatsApp prüfen lassen.';
            if (includeCompassStatus) {
                const caseTitle = document.getElementById('compassCaseTitle')?.innerText || '';
                const items = Array.from(document.querySelectorAll('#compassDocList li'));
                const checkedCount = items.filter(li => li.getAttribute('data-checked') === '1').length;
                if (caseTitle) text += `\n\n*Anliegen:* ${caseTitle}`;
                if (items.length > 0 && checkedCount > 0) {
                    const summary = items.map(li => `${li.getAttribute('data-checked') === '1' ? '✅' : '⬜'} ${li.innerText.trim()}`).join('\n');
                    text += `\n*Mein Unterlagen-Stand (${checkedCount}/${items.length}):*\n${summary}`;
                }
                text += '\n\nIch sende Ihnen gleich die Fotos der Papiere.';
            }
            window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank');
        };

        window.openViralShareModal = function() {
            document.getElementById('viralShareOverlay').classList.add('open');
        };

        window.loadExternalQrCode = function() {
            const box = document.getElementById('viralQrBox');
            if (!box) return;
            const targetUrl = window.location.href.startsWith('http') ? window.location.href : 'https://wa.me/491783783875';
            box.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(targetUrl)}" alt="RED Berlin QR Code" referrerpolicy="no-referrer" style="width:170px; height:170px; display:block;">`;
        };

        window.closeViralShareModal = function() {
            document.getElementById('viralShareOverlay').classList.remove('open');
        };

        window.shareViaWhatsApp = function() {
            const url = window.location.href.startsWith('http') ? window.location.href : 'Kienitzer Str. 6, 12053 Berlin (Tel: 0178 378 38 75)';
            const text = encodeURIComponent(`🔥 Empfehlung für Kfz-Zulassung & Sofortkennzeichen in Berlin:\nRED Zulassungsdienst Berlin (Tamer Yazici) – Schnell, zuverlässig & ohne Wartezeit!\n👉 ${url}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
        };

        window.copyWebsiteLink = function() {
            const url = window.location.href.startsWith('http') ? window.location.href : 'RED Zulassungsdienst Berlin - Kienitzer Str. 6, 12053 Berlin - Tel: 0178 378 38 75';
            navigator.clipboard.writeText(url).then(() => {
                window.showToast('Link & Kontaktdaten kopiert!', 'success');
            }).catch(() => {
                window.showToast('Kopiert!', 'success');
            });
        };

        window.ankaufSelectedCondition = 'Fahrbereit & Gepflegt';

        window.selectAnkaufCondition = function(condLabel, btnEl) {
            window.ankaufSelectedCondition = condLabel;
            document.querySelectorAll('#ankaufConditionPills .ankauf-cond-pill').forEach(p => p.classList.remove('active'));
            if (btnEl) btnEl.classList.add('active');
        };

        window.submitAnkaufInquiry = async function(viaWhatsApp = true) {
            const model = document.getElementById('ankaufModel')?.value.trim() || '';
            const year = document.getElementById('ankaufYear')?.value.trim() || '';
            const km = document.getElementById('ankaufKm')?.value.trim() || '';
            const fuel = document.getElementById('ankaufFuel')?.value.trim() || '';
            const price = document.getElementById('ankaufPrice')?.value.trim() || '';
            const phone = document.getElementById('ankaufPhone')?.value.trim() || '';
            const condition = window.ankaufSelectedCondition || 'Fahrbereit & Gepflegt';

            if (!model) {
                window.showToast('Bitte mindestens Marke & Modell eingeben.', 'error');
                return;
            }
            if (!viaWhatsApp && !phone) {
                window.showToast('Bitte Ihre Telefonnummer für unser Rückruf-Angebot eingeben.', 'error');
                return;
            }

            const summaryNote = `Zustand: ${condition} | EZ: ${year || '-'} | KM: ${km || '-'} | ${fuel || '-'} | Preiswunsch: ${price || '-'}`;
            const todayDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

            if (window.firebaseDb && window.firebaseAddDoc) {
                try {
                    await window.firebaseAddDoc(window.firebaseCollection(window.firebaseDb, "appointments"), {
                        name: `Ankauf: ${model}`,
                        phone: phone || 'Über WhatsApp',
                        email: 'Auto-Ankauf Anfrage',
                        date: todayDate,
                        timeLabel: 'Sofort-Bewertung',
                        service: `🚗 AUTO ANKAUF: ${model}`,
                        category: 'Auto Ankauf',
                        customNote: summaryNote,
                        marked: true,
                        orderStatus: 1,
                        notes: [{ id: Date.now().toString(), text: summaryNote, timeStr: 'Auto-Ankauf Formular' }],
                        timestamp: Date.now()
                    });
                } catch (e) {}
            }

            if (typeof window.sendToMakeWebhook === 'function') {
                window.sendToMakeWebhook({
                    type: 'callback_request',
                    clientName: `Auto-Ankauf (${model})`,
                    clientCategory: 'Auto Ankauf',
                    clientPhone: phone || 'Über WhatsApp',
                    clientEmail: '-',
                    date: todayDate,
                    time: 'Sofort-Bewertung',
                    service: `Auto Ankauf: ${model}`,
                    wunschkennzeichen: '-',
                    customNote: summaryNote
                });
            }

            if (viaWhatsApp) {
                let waPhone = (window.dynamicContactData?.phone || '01783783875').replace(/\D/g, '');
                if (waPhone.startsWith('0')) waPhone = '49' + waPhone.substring(1);
                const msg = encodeURIComponent(`🚗 *AUTO-ANKAUF BLITZ-ANFRAGE (RED BERLIN)*\n\n• *Fahrzeug:* ${model}\n• *Zustand:* ${condition}\n• *Baujahr/EZ:* ${year || '-'}\n• *Kilometerstand:* ${km || '-'}\n• *Motor/Getriebe:* ${fuel || '-'}\n• *Preiswunsch / Info:* ${price || '-'}${phone ? '\n• *Rückruf-Nr.:* ' + phone : ''}\n\nBitte um ein unverbindliches Höchstpreis-Angebot inkl. kostenloser Abmeldung!`);
                window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
            } else {
                window.showToast('🚗 Ihre Ankauf-Anfrage wurde gesendet! Wir melden uns in Kürze.', 'success');
                document.getElementById('ankaufModel').value = '';
                document.getElementById('ankaufYear').value = '';
                document.getElementById('ankaufKm').value = '';
                document.getElementById('ankaufPrice').value = '';
                document.getElementById('ankaufPhone').value = '';
            }
        };

        window.sendAnkaufWhatsApp = function() {
            window.submitAnkaufInquiry(true);
        };

        window._activeTrackerUnsub = null;

        window.renderTrackerStatusData = function(data, fallbackCode) {
            const resBox = document.getElementById('liveTrackerResultBox');
            if (!resBox) return;
            resBox.style.display = 'block';
            const step = Number(data.orderStatus) || 1;
            const stepLabels = {
                1: '1. Unterlagen & Termin erfasst',
                2: '2. In Bearbeitung beim LABO',
                3: '3. Schilder geprägt & Siegel',
                4: '4. Fertig & Abholbereit!'
            };
            const codeText = data.code || fallbackCode || '';
            const timeInfo = data.timeLabel ? ` • ${data.timeLabel}` : '';
            const dateInfo = data.date ? ` (${data.date}${timeInfo})` : '';
            const plateInfo = data.wunschkennzeichen ? ` | Kennz.: ${data.wunschkennzeichen}` : '';

            document.getElementById('trackerClientTitle').innerText = `Auftrag ${codeText}${dateInfo} – ${stepLabels[step] || stepLabels[1]}`;
            document.getElementById('trackerServiceBadge').innerText = (data.service || 'Kfz-Zulassung') + plateInfo;

            for (let i = 1; i <= 4; i++) {
                const stepEl = document.getElementById('tStep' + i);
                if (!stepEl) continue;
                stepEl.classList.remove('active', 'completed');
                if (i < step) stepEl.classList.add('completed');
                else if (i === step) stepEl.classList.add('active');
            }
        };

        window.checkLiveOrderStatus = async function() {
            const inputEl = document.getElementById('liveTrackerInput');
            let code = (inputEl?.value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
            if (/^\d{6}$/.test(code)) {
                code = 'RED-' + code;
                if (inputEl) inputEl.value = code;
            }
            if (!/^RED-\d{6}$/.test(code)) {
                window.showToast('Bitte gültigen Prüfcode eingeben (z.B. RED-123456).', 'error');
                return;
            }

            if (typeof window._activeTrackerUnsub === 'function') {
                window._activeTrackerUnsub();
                window._activeTrackerUnsub = null;
            }

            const getLocalTrackerFallback = (targetCode) => {
                const fromApts = (window.redApts || []).find(a => a.trackingCode === targetCode);
                if (fromApts) {
                    return {
                        code: targetCode,
                        date: fromApts.date,
                        timeLabel: fromApts.timeLabel,
                        service: fromApts.service,
                        wunschkennzeichen: fromApts.wunschkennzeichen,
                        orderStatus: fromApts.orderStatus || 1
                    };
                }
                try {
                    const localMap = JSON.parse(localStorage.getItem('red_local_tracking_map') || '{}');
                    if (localMap[targetCode]) return localMap[targetCode];
                } catch (e) {}
                return null;
            };

            const resBox = document.getElementById('liveTrackerResultBox');
            try {
                const docRef = window.firebaseDoc(window.firebaseDb, "order_tracking", code);
                const snap = await window.firebaseGetDoc(docRef);

                if (!snap.exists()) {
                    const localFallback = getLocalTrackerFallback(code);
                    if (localFallback) {
                        window.renderTrackerStatusData(localFallback, code);
                        window.showToast('Auftragsstatus geladen!', 'success');
                        return;
                    }
                    if (resBox) resBox.style.display = 'none';
                    window.showToast(`Code ${code} nicht gefunden. Bitte Schreibweise prüfen oder neu buchen.`, 'error');
                    return;
                }

                window.renderTrackerStatusData(snap.data(), code);
                window.showToast('Auftragsstatus erfolgreich geladen!', 'success');

                // Live-Updates bei Statusänderungen im Admin-Bereich
                if (typeof window.firebaseOnSnapshot === 'function') {
                    window._activeTrackerUnsub = window.firebaseOnSnapshot(docRef, (liveSnap) => {
                        if (liveSnap.exists()) {
                            window.renderTrackerStatusData(liveSnap.data(), code);
                        }
                    }, () => {});
                }
            } catch (err) {
                console.error('Tracker-Abfrage Fehler:', err);
                const localFallback = getLocalTrackerFallback(code);
                if (localFallback) {
                    window.renderTrackerStatusData(localFallback, code);
                    window.showToast('Auftragsstatus geladen!', 'success');
                    return;
                }
                if (resBox) resBox.style.display = 'none';
                window.showToast('Prüfung fehlgeschlagen: Bitte Firestore-Leserechte für order_tracking prüfen.', 'error');
            }
        };

        // --- DATEI-UPLOAD LABEL HELFER ---
        window.updateFileLabel = function(input) {
            const label = document.getElementById('fileLabelText');
            if(input.files && input.files[0]) {
                label.innerHTML = `<i class="fa-solid fa-check" style="color:#25D366;"></i> ${input.files[0].name}`;
            } else {
                label.innerHTML = `<i class="fa-solid fa-folder-open"></i> Datei auswählen`;
            }
        };

        window.updateCbFileLabel = function(input) {
            const label = document.getElementById('cbFileLabelText');
            if(input.files && input.files[0]) {
                label.innerHTML = `<i class="fa-solid fa-check" style="color:#25D366;"></i> ${input.files[0].name}`;
            } else {
                label.innerHTML = `<i class="fa-solid fa-upload"></i> Durchsuchen`;
            }
        };

        window.updateNewFormFileLabel = function(input) {
            const label = document.getElementById('newFormFileLabel');
            if(input.files && input.files[0]) {
                label.innerHTML = `<i class="fa-solid fa-check" style="color:#25D366;"></i> ${input.files[0].name}`;
            } else {
                label.innerHTML = `<i class="fa-solid fa-file-arrow-up"></i> PDF/Datei vom Gerät wählen`;
            }
        };

        window.updateEditFormFileLabel = function(input) {
            const label = document.getElementById('editFormFileLabel');
            if(input.files && input.files[0]) {
                label.innerHTML = `<i class="fa-solid fa-check" style="color:#25D366;"></i> ${input.files[0].name}`;
            } else {
                label.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> PDF / Datei auswählen`;
            }
        };

        window.enableGoogleMaps = function() {
            const container = document.getElementById('googleMapContainer');
            if(!container) return;
            localStorage.setItem('red_maps_consent', 'true');
            container.innerHTML = `<iframe src="https://maps.google.com/maps?q=Kienitzer%20Str.%206,%2012053%20Berlin&t=&z=15&ie=UTF8&iwloc=&output=embed" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
        };

        // --- SCHNELL-KALKULATOR (MIT AKTUELLEN PREISEN & PER STIFT BEARBEITBAR) ---
        const defaultCalcItems = [
            { id: "c-1", name: "Anmeldung mit Wunschkennzeichen (inkl. Gebühren, Schilder & Plakette)", price: "100", selected: true },
            { id: "c-2", name: "Anmeldung mit Zufalls-/Listenkennzeichen (inkl. Gebühren, Schilder & Plakette)", price: "90", selected: false },
            { id: "c-3", name: "Ummeldung mit gleichem Kennzeichen (angemeldetes Fahrzeug)", price: "70", selected: false },
            { id: "c-4", name: "Abmeldung (regulär vor Ort)", price: "30", selected: false },
            { id: "c-5", name: "Online-Abmeldung (digital)", price: "20", selected: false },
            { id: "c-6", name: "Kurzzeitkennzeichen (6 Tage)", price: "120", selected: false },
            { id: "c-7", name: "Zoll- / Ausfuhrkennzeichen (30 Tage)", price: "350", selected: false },
            { id: "c-8", name: "1 Paar Kennzeichen (Sofortprägung vor Ort)", price: "30", selected: false },
            { id: "c-9", name: "Einzelnes Kennzeichen (1 Stück Sofortprägung)", price: "15", selected: false }
        ];

        window.calcItemsData = JSON.parse(localStorage.getItem('red_calc_items_v3')) || defaultCalcItems;

        window.renderCalcItems = function(items) {
            const list = document.getElementById('calcOptionsList');
            if(!list) return;
            list.innerHTML = '';

            items.forEach(item => {
                const isSel = !!item.selected;
                const priceText = (!item.price || item.price.trim() === '' || item.price.trim() === '-') 
                    ? 'Auf Anfrage' 
                    : (item.price.includes('€') ? item.price : `${item.price} €`);

                const row = document.createElement('div');
                row.className = `calc-item ${isSel ? 'selected' : ''}`;
                row.setAttribute('data-id', item.id);
                row.onclick = () => window.toggleCalcOption(item.id);

                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; flex:1; text-align:left;">
                        <i class="${isSel ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'}" style="color:${isSel ? 'var(--primary-red)' : 'var(--text-muted)'}; font-size:15px; flex-shrink:0;"></i>
                        <span>${item.name}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong style="color:var(--primary-red); white-space:nowrap;">${priceText}</strong>
                        <button type="button" class="mini-admin-btn edit action-prices" onclick="event.stopPropagation(); window.openCalcEditModal('${item.id}')" title="Mit Stift bearbeiten"><i class="fa-solid fa-pencil"></i></button>
                        <button type="button" class="mini-admin-btn del action-prices" onclick="event.stopPropagation(); window.deleteCalcItem('${item.id}')" title="Position löschen"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                list.appendChild(row);
            });

            window.recalculateTotal();
        };

        window.toggleCalcOption = function(id) {
            const idx = window.calcItemsData.findIndex(i => i.id === id);
            if(idx > -1) {
                window.calcItemsData[idx].selected = !window.calcItemsData[idx].selected;
                window.renderCalcItems(window.calcItemsData);
            }
        };

        window.recalculateTotal = function() {
            let sum = 0;
            let hasNumericPrice = false;

            window.calcItemsData.forEach(item => {
                if(item.selected && item.price && item.price.trim() !== '-') {
                    const numMatch = String(item.price).replace(',', '.').match(/\d+(\.\d+)?/);
                    if(numMatch) {
                        sum += parseFloat(numMatch[0]);
                        hasNumericPrice = true;
                    }
                }
            });

            const totalEl = document.getElementById('calcTotalSum');
            if(!totalEl) return;
            if(!hasNumericPrice) {
                totalEl.innerText = 'Auf Anfrage';
            } else {
                const formatted = Number.isInteger(sum) ? sum : sum.toFixed(2).replace('.', ',');
                totalEl.innerText = `ab ${formatted} €`;
            }
        };

        window.openCalcEditModal = function(id) {
            const item = window.calcItemsData.find(i => i.id === id);
            if(!item) return;
            document.getElementById('calcEditId').value = item.id;
            document.getElementById('calcEditName').value = item.name;
            document.getElementById('calcEditPrice').value = item.price || '-';
            document.getElementById('calcEditDefault').value = item.selected ? 'true' : 'false';
            document.getElementById('calcItemEditOverlay').classList.add('open');
        };

        window.closeCalcEditModal = function() {
            document.getElementById('calcItemEditOverlay').classList.remove('open');
        };

        window.saveCalcItemEdit = async function() {
            const id = document.getElementById('calcEditId').value;
            const name = document.getElementById('calcEditName').value.trim();
            const price = document.getElementById('calcEditPrice').value.trim() || '-';
            const selected = document.getElementById('calcEditDefault').value === 'true';

            if(!name) { window.showToast('Bitte Bezeichnung eingeben.', 'error'); return; }

            const idx = window.calcItemsData.findIndex(i => i.id === id);
            if(idx > -1) {
                window.calcItemsData[idx] = { id, name, price, selected };
            }

            localStorage.setItem('red_calc_items_v2', JSON.stringify(window.calcItemsData));
            window.renderCalcItems(window.calcItemsData);

            if(window.firebaseDb && window.firebaseSetDoc) {
                try {
                    await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "settings", "calc_items"), { list: window.calcItemsData });
                    window.showToast('Kalkulator-Position online gespeichert!', 'success');
                } catch(e) {
                    window.showToast('Lokal gespeichert.', 'success');
                }
            }
            window.closeCalcEditModal();
        };

        window.addNewCalcItem = async function() {
            const newItem = {
                id: 'c-' + Date.now(),
                name: 'Neue Zusatzoption',
                price: '-',
                selected: false
            };
            window.calcItemsData.push(newItem);
            localStorage.setItem('red_calc_items_v2', JSON.stringify(window.calcItemsData));
            window.renderCalcItems(window.calcItemsData);

            if(window.firebaseDb && window.firebaseSetDoc) {
                try {
                    await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "settings", "calc_items"), { list: window.calcItemsData });
                } catch(e) {}
            }
            window.openCalcEditModal(newItem.id);
        };

        window.deleteCalcItem = function(id) {
            window.openRedDeleteConfirm(
                'Kalkulator-Option löschen?',
                'Möchten Sie diese Position wirklich dauerhaft aus dem Schnell-Kalkulator entfernen?',
                async () => {
                    window.calcItemsData = window.calcItemsData.filter(i => i.id !== id);
                    localStorage.setItem('red_calc_items_v2', JSON.stringify(window.calcItemsData));
                    window.renderCalcItems(window.calcItemsData);

                    if(window.firebaseDb && window.firebaseSetDoc) {
                        try {
                            await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "settings", "calc_items"), { list: window.calcItemsData });
                            window.showToast('Option gelöscht!', 'success');
                        } catch(e) {}
                    }
                }
            );
        };

        window.applyCalcToBooking = function() {
            const selectedItems = window.calcItemsData.filter(i => i.selected).map(i => i.name);
            if(selectedItems.length === 0) {
                window.showToast('Bitte mindestens eine Option im Kalkulator auswählen.', 'error');
                return;
            }
            const combined = selectedItems.join(' + ');
            window.selectedServiceVal = combined;
            document.getElementById('selectTriggerText').innerText = combined.length > 42 ? combined.substring(0, 42) + '...' : combined;
            window.updateBookingLiveSummary();
            document.getElementById('termin').scrollIntoView({ behavior: 'smooth' });
            window.showToast('Auswahl in das Buchungsformular übertragen!', 'success');
        };

        window.normalizeDateDE = function(dateStr) {
            const s = String(dateStr || '').trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                const p = s.substring(0, 10).split('-');
                return `${p[2]}.${p[1]}.${p[0]}`;
            }
            if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(s)) {
                const p = s.split('.');
                return `${p[0].padStart(2, '0')}.${p[1].padStart(2, '0')}.${p[2].substring(0, 4)}`;
            }
            return s;
        };

        // --- KALENDER (.ICS) DOWNLOAD ---
        window.lastBookedApt = null;
        window.downloadBookingICS = function() {
            const apt = window.lastBookedApt;
            if(!apt) { window.showToast('Kein aktueller Termin ausgewählt.', 'error'); return; }

            const cleanDate = window.normalizeDateDE(apt.date);
            const parts = cleanDate.split('.');
            let y = window.getDynamicSystemYear(), m = '01', d = '01';
            if(parts.length === 3) { d = parts[0].padStart(2,'0'); m = parts[1].padStart(2,'0'); y = parts[2]; }

            let startH = '09', startM = '00', endH = '10', endM = '00';
            const tMatch = String(apt.time || '').match(/(\d{1,2}):(\d{2})/);
            if(tMatch) {
                startH = tMatch[1].padStart(2, '0'); startM = tMatch[2];
                endH = String(Math.min(23, parseInt(startH, 10) + 1)).padStart(2, '0');
                endM = startM;
            }

            const dtStart = `${y}${m}${d}T${startH}${startM}00`;
            const dtEnd = `${y}${m}${d}T${endH}${endM}00`;
            const icsContent = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//RED Zulassungsdienst Berlin//DE",
                "BEGIN:VEVENT",
                `SUMMARY:Kfz-Termin: ${apt.service} (RED Zulassungsdienst)`,
                `DTSTART:${dtStart}`,
                `DTEND:${dtEnd}`,
                "LOCATION:Kienitzer Str. 6\\, 12053 Berlin",
                `DESCRIPTION:Ihr Termin bei RED Zulassungsdienst Berlin (Ansprechpartner: Tamer Yazici).${apt.trackingCode ? ' Auftrags-Code (Live-Tracker): ' + apt.trackingCode + '.' : ''}${apt.wunschkennzeichen ? ' Wunschkennzeichen: ' + apt.wunschkennzeichen + '.' : ''}${apt.customNote ? ' Hinweis: ' + apt.customNote + '.' : ''} Bitte alle Originaldokumente mitbringen.`,
                "END:VEVENT",
                "END:VCALENDAR"
            ].join("\r\n");

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RED_Termin_${cleanDate}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showToast('Kalendereintrag heruntergeladen!', 'success');
        };

        // --- LIVE-LEADS MONITORING FILTER, SORTIERUNG & ARCHIV-STEUERUNG ---
        window.currentLeadFilter = 'open';
        window.adminLeadSortMode = 'priority';

        window.safeOpenCRMFromTerminal = function() {
            const isSup = document.body.classList.contains('is-supervisor');
            if (isSup || window.adminPermissions?.crm) {
                window.openCRM();
            } else {
                window.showToast('Der Supervisor hat das Kunden-CRM für dieses Konto gesperrt.', 'error');
            }
        };

        window.changeAdminLeadSort = function(mode) {
            window.adminLeadSortMode = mode || 'priority';
            if (typeof window.refreshAdminAppointmentsView === 'function') {
                window.refreshAdminAppointmentsView();
            }
        };

        window.setLeadStatusFilter = function(filterKey, btnEl) {
            window.currentLeadFilter = filterKey || 'open';
            document.querySelectorAll('#adminLeadFilterPills .admin-filter-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-filter') === window.currentLeadFilter);
            });
            document.querySelectorAll('#adminKpiGrid .admin-kpi-box').forEach(box => {
                box.classList.toggle('is-selected', box.getAttribute('data-kpi-filter') === window.currentLeadFilter);
            });
            window.filterAdminLeads();
        };

        window.filterAdminLeads = function() {
            const q = (document.getElementById('adminLeadSearch')?.value || '').trim().toLowerCase();
            const f = window.currentLeadFilter || 'open';
            const openSection = document.getElementById('adminOpenSectionWrap');
            const archiveDetails = document.getElementById('adminCompletedArchive');

            let visibleOpen = 0;
            let visibleDone = 0;

            document.querySelectorAll('#admin-list .admin-apt-card').forEach(card => {
                const textMatch = !q || card.innerText.toLowerCase().includes(q);
                const statusAttr = card.getAttribute('data-status-cat') || 'planned';
                const isPinned = card.getAttribute('data-pinned') === 'true';
                const isLabo = card.getAttribute('data-labo') === 'true';
                const isDone = (statusAttr === 'done');

                let filterMatch = true;
                if (f === 'open') filterMatch = !isDone;
                else if (f === 'today') filterMatch = (statusAttr === 'today');
                else if (f === 'planned') filterMatch = (statusAttr === 'planned');
                else if (f === 'expired') filterMatch = (statusAttr === 'expired');
                else if (f === 'done') filterMatch = isDone;
                else if (f === 'labo') filterMatch = isLabo;
                else if (f === 'pinned') filterMatch = isPinned;
                else if (f === 'all') filterMatch = true;

                // Im Standardfilter "open" bleiben erledigte Karten im eingeklappten Archiv erhalten (per Suche oder Klick ausklappbar)
                const isInArchive = !!card.closest('#adminCompletedArchive');
                let show = textMatch && filterMatch;
                if (f === 'open' && isInArchive) {
                    show = textMatch;
                }

                card.style.display = show ? 'flex' : 'none';
                if (show) {
                    if (isInArchive) visibleDone++;
                    else visibleOpen++;
                }
            });

            if (openSection) {
                openSection.style.display = (f === 'done') ? 'none' : 'block';
            }
            if (archiveDetails) {
                const showArchiveBlock = (f === 'open' || f === 'done' || f === 'all' || (q && visibleDone > 0) || (f === 'pinned' && visibleDone > 0));
                archiveDetails.style.display = (showArchiveBlock && (visibleDone > 0 || f === 'done')) ? 'block' : 'none';
                if (f === 'done' || f === 'all' || (q && visibleDone > 0)) {
                    archiveDetails.open = true;
                } else if (f === 'open' && !q) {
                    archiveDetails.open = false;
                }
            }

            const emptyOpenMsg = document.getElementById('adminOpenEmptyHint');
            if (emptyOpenMsg) {
                emptyOpenMsg.style.display = (visibleOpen === 0 && f !== 'done') ? 'block' : 'none';
            }
        };

        // =========================================================================
        // 9. ARGON DESIGN-SYSTEM: HELL-/DUNKELMODUS & KUNDEN-UMSCHALTER IM HEADER
        // =========================================================================
        window.updateCustomerThemeIcon = function(themeName) {
            const icon = document.getElementById('customerThemeIcon');
            const metaTheme = document.getElementById('metaThemeColor');
            const isLight = !themeName || themeName.startsWith('light');
            if(icon) {
                icon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
                icon.style.color = isLight ? '#ffffff' : '#ffcc00';
            }
            if(metaTheme) {
                metaTheme.setAttribute('content', '#0b0b10');
            }
        };

        window.toggleCustomerLightDark = function() {
            const current = document.body.getAttribute('data-theme') || 'light';
            const nextTheme = current.startsWith('light') ? 'dark' : 'light';
            sessionStorage.setItem('red_customer_manual_theme', nextTheme);
            window.changeTheme(nextTheme, false);
            window.showToast(nextTheme === 'light' ? '☀️ Hellmodus aktiviert' : '🌙 Argon Dunkelmodus aktiviert', 'success');
        };

        window.changeTheme = async function(themeName, saveToFirebase = false) {
            if(!themeName) themeName = 'light';
            if (document.body.getAttribute('data-theme') !== themeName) {
                document.body.classList.add('theme-transitioning');
                clearTimeout(window._themeTransTimer);
                window._themeTransTimer = setTimeout(() => {
                    document.body.classList.remove('theme-transitioning');
                }, 480);
            }
            document.body.setAttribute('data-theme', themeName);
            localStorage.setItem('red_theme_v3', themeName);
            window.updateCustomerThemeIcon(themeName);
            
            if (saveToFirebase && window.isAuthorized && window.firebaseSetDoc && window.firebaseDb) {
                try {
                    const customData = JSON.parse(localStorage.getItem('red_custom_theme') || 'null');
                    await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "settings", "global_theme_v3"), { activeTheme: themeName, customVars: customData }, { merge: true });
                    window.showToast('Design global für alle Geräte gespeichert!', 'success');
                } catch (e) {
                    window.showToast('Konnte Design online nicht speichern.', 'error');
                }
            }
            
            document.documentElement.style.cssText = '';
            window.syncHeaderHeight();
            
            if (themeName === 'custom') {
                const customTheme = JSON.parse(localStorage.getItem('red_custom_theme'));
                if (customTheme) {
                    for (const [key, value] of Object.entries(customTheme)) {
                        document.documentElement.style.setProperty(key, value);
                    }
                }
            }
        };

        window.applySelectedTheme = function() {
            const selector = document.getElementById('themeSelector');
            if(selector) {
                window.changeTheme(selector.value, true);
            }
        };

        window.syncThemeStudioInputs = function() {
            setTimeout(() => {
                const style = getComputedStyle(document.body);
                const toHex = (v, fb) => /^#[0-9a-f]{6}$/i.test((v || '').trim()) ? v.trim() : fb;
                if (document.getElementById('tePrimary')) document.getElementById('tePrimary').value = toHex(style.getPropertyValue('--primary-red'), '#d90000');
                if (document.getElementById('teText')) document.getElementById('teText').value = toHex(style.getPropertyValue('--text-light'), '#141417');
                if (document.getElementById('teBg')) document.getElementById('teBg').value = toHex(style.getPropertyValue('--bg-dark'), '#eceef3');
                if (document.getElementById('teCard')) document.getElementById('teCard').value = toHex(style.getPropertyValue('--bg-card'), '#ffffff');
                if (document.getElementById('teInput')) document.getElementById('teInput').value = toHex(style.getPropertyValue('--bg-input'), '#f0f0f5');
                window.updateThemeStudioPreview();
            }, 60);
        };

        window.updateThemeStudioPreview = function() {
            const p = document.getElementById('tePrimary')?.value || '#d90000';
            const t = document.getElementById('teText')?.value || '#141417';
            const bg = document.getElementById('teBg')?.value || '#eceef3';
            const card = document.getElementById('teCard')?.value || '#ffffff';
            const inp = document.getElementById('teInput')?.value || '#f0f0f5';
            const rad = document.getElementById('teRadius')?.value || '20px';
            const brad = document.getElementById('teBtnRadius')?.value || '50px';
            const glow = document.getElementById('teGlowStyle')?.value || '0 10px 25px rgba(0, 0, 0, 0.08)';

            const setHex = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = String(val).toUpperCase(); };
            setHex('tePrimaryHex', p); setHex('teTextHex', t); setHex('teBgHex', bg); setHex('teCardHex', card); setHex('teInputHex', inp);

            const stage = document.getElementById('teLiveStage');
            const cEl = document.getElementById('teLiveCard');
            const iEl = document.getElementById('teLiveInput');
            const bEl = document.getElementById('teLiveBtn');
            if (stage) stage.style.background = bg;
            if (cEl) { cEl.style.background = card; cEl.style.color = t; cEl.style.borderRadius = rad; cEl.style.boxShadow = glow; }
            if (iEl) { iEl.style.background = inp; iEl.style.color = t; }
            if (bEl) { bEl.style.background = p; bEl.style.borderRadius = brad; }
        };

        window.openThemeEditor = function() {
            if(!window.isAuthorized) return;
            document.getElementById('themeEditorOverlay').classList.add('open');
            window.syncThemeStudioInputs();
        };

        window.closeThemeEditor = function() {
            document.getElementById('themeEditorOverlay').classList.remove('open');
        };

        window.saveCustomTheme = function() {
            const pRed = document.getElementById('tePrimary').value;
            const tLight = document.getElementById('teText').value;
            const bDark = document.getElementById('teBg').value;
            const bCard = document.getElementById('teCard').value;
            const bInput = document.getElementById('teInput') ? document.getElementById('teInput').value : bCard;
            const bRadius = document.getElementById('teRadius') ? document.getElementById('teRadius').value : '20px';
            const btnRadius = document.getElementById('teBtnRadius') ? document.getElementById('teBtnRadius').value : '50px';
            const glowStyle = document.getElementById('teGlowStyle') ? document.getElementById('teGlowStyle').value : '0 10px 25px rgba(0, 0, 0, 0.08)';

            const glassBg = bDark + 'f0'; 
            const glassBorder = tLight + '22';

            const customTheme = {
                '--primary-red': pRed,
                '--text-light': tLight,
                '--text-muted': tLight + 'b3', 
                '--bg-dark': bDark,
                '--bg-card': bCard,
                '--bg-input': bInput,
                '--glass-bg': glassBg,
                '--glass-border': glassBorder,
                '--border-hover': pRed,
                '--global-radius': bRadius,
                '--btn-radius': btnRadius,
                '--card-shadow': glowStyle
            };

            localStorage.setItem('red_custom_theme', JSON.stringify(customTheme));
            document.getElementById('themeSelector').value = 'custom';
            window.changeTheme('custom', true);
            window.showToast('Eigenes Design & Effekte erfolgreich angewendet!', 'success');
            window.closeThemeEditor();
        };

        window.resetCustomTheme = function() {
            localStorage.removeItem('red_custom_theme');
            sessionStorage.removeItem('red_customer_manual_theme');
            document.documentElement.style.cssText = '';
            document.getElementById('themeSelector').value = 'light';
            window.changeTheme('light', true);
            window.showToast('Auf Standard-Design (Hellmodus) zurückgesetzt!', 'success');
            window.closeThemeEditor();
        };

        const initialTheme = sessionStorage.getItem('red_customer_manual_theme') || localStorage.getItem('red_theme_v3') || 'light';
        window.changeTheme(initialTheme, false);

        document.addEventListener('DOMContentLoaded', () => {
            window.initPwaSystem();
            window.initAutomaticYearSystem();
            window.initFloatingPlates();
            window.updateHeaderCalendarChip();
            window.updateDispatchCountdown();
            window.renderCalcItems(window.calcItemsData);
            if(localStorage.getItem('red_maps_consent') === 'true') {
                window.enableGoogleMaps();
            }
            if(document.getElementById('themeSelector')) {
                document.getElementById('themeSelector').value = initialTheme;
            }
            window.updateCustomerThemeIcon(initialTheme);
            const sndBtn = document.getElementById('adminSoundToggleBtn');
            if(sndBtn && !window.adminSoundEnabled) {
                sndBtn.style.color = 'var(--text-muted)';
                sndBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Ton: Aus';
            }
        });

        window.redApts = JSON.parse(localStorage.getItem('red_local_apts') || '[]');
        window.currentWeatherData = null;
        window.modalClockInterval = null;
        window.DEFAULT_MAKE_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwjO812Bj4F3Mv3ETwf5BMrus72HPcbvX7Mtgy030KGSd7bgmP76Cm0hCBaEKyy0Z_v/exec';
        window.dynamicContactData = { 
            phone: '0178 378 38 75', 
            email: 'Redzulassungsdienst@gmail.com', 
            ustid: '(Hier Steuernummer eintragen)', 
            ig: 'https://instagram.com/red_zulassungsdienst', 
            fb: '#',
            webhook: window.DEFAULT_MAKE_WEBHOOK
        };

        window.sendToMakeWebhook = async function(payload) {
            const webhookUrl = ((window.dynamicContactData?.webhook || '').trim()) || window.DEFAULT_MAKE_WEBHOOK;
            if (!webhookUrl.startsWith('https://')) return;

            const cleanPhone = String(payload.clientPhone || '').replace(/\D/g, '').replace(/^0/, '49');
            const waReplyLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '';
            const isCallback = payload.type === 'callback_request';

            const messageText = [
                isCallback ? '📞 NEUE 60s RÜCKRUF-ANFRAGE (RED BERLIN)' : '📅 NEUER TERMIN – RED ZULASSUNGSDIENST BERLIN',
                '',
                `• Kunde: ${payload.clientName || '-'} (${payload.clientCategory || 'Privatkunde'})`,
                `• Telefon: ${payload.clientPhone || '-'}`,
                `• E-Mail: ${payload.clientEmail || '-'}`,
                `• Datum & Zeit: ${payload.date || '-'} um ${payload.time || '-'}`,
                `• Leistung: ${payload.service || '-'}`,
                `• Wunschkennzeichen: ${payload.wunschkennzeichen || '-'}`,
                `• Hinweis: ${payload.customNote || '-'}`,
                payload.trackingCode ? `• Tracker-Code: ${payload.trackingCode}` : '',
                waReplyLink ? `• Direkt-Antwort WhatsApp: ${waReplyLink}` : ''
            ].filter(Boolean).join('\n');

            const formBody = new URLSearchParams();
            const fullData = {
                ...payload,
                adminEmail: window.dynamicContactData?.email || 'Redzulassungsdienst@gmail.com',
                adminWhatsapp: '491783783875',
                waReplyLink: waReplyLink,
                messageText: messageText,
                sentAt: new Date().toLocaleString('de-DE')
            };
            Object.entries(fullData).forEach(([k, v]) => formBody.append(k, v == null ? '' : String(v)));

            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    keepalive: true,
                    body: formBody
                });
            } catch (err) {
                console.error('Make Webhook Fehler:', err);
            }
        };

        window.adminPermissions = {
            leads: true, prices: true, customblocks: true, content: true, companydata: true, forms: true, cars: true, ticker: true, crm: true, pages: true, theme: true, invoice: false, shopgallery: false, videos: false
        };

        window.ALL_SUPERVISOR_PERM_IDS = ['permLeads','permCrm','permInvoice','permShopgallery','permVideos','permPrices','permForms','permCars','permCustomblocks','permContent','permPages','permTheme','permTicker','permCompanydata'];

        window.updateSupervisorPermCounter = function() {
            const ids = window.ALL_SUPERVISOR_PERM_IDS;
            const active = ids.filter(id => document.getElementById(id)?.checked).length;
            const badge = document.getElementById('supPermActiveCount');
            if (badge) badge.innerText = `${active} / ${ids.length} Aktiv`;
        };

        window.toggleAllSupervisorPerms = function(state) {
            window.ALL_SUPERVISOR_PERM_IDS.forEach(id => {
                const el = document.getElementById(id);
                if(el) el.checked = state;
            });
            window.updateSupervisorPermCounter();
        };

        // --- ALLE SEITENTEXTE MIT STIFT BEARBEITBAR ---
        window.pageContentData = {
            "header": {
                "title_red": "RED",
                "title_sub": "ZULASSUNGSDIENST & SCHILDER",
                "icon_car": "svg-sport",
                "car_anim": "car-anim-idle",
                "car_color": "var(--text-light)",
                "txt_crm": "KUNDEN",
                "icon_crm": "fa-database",
                "txt_visitors": "Besuche:",
                "icon_visitors": "fa-users"
            },
            "hero": {
                "badge": "Sofortkennzeichen zum Mitnehmen!",
                "h1_1": "Schnell. Zuverlässig.",
                "h1_2": "Kompetent.",
                "desc": "Zulassungsservice in Bestzeit für ganz Berlin. Wir garantieren Ihnen eine zügige, zuverlässige und hochprofessionelle Abwicklung Ihrer Anliegen."
            },
            "leistungen": {
                "title": "Unsere Leistungen",
                "desc": "Klicken Sie direkt auf eine Karte für detaillierte Infos & benötigte Unterlagen"
            },
            "tools": {
                "wk_title": "Berliner Wunschkennzeichen Studio",
                "wk_desc": "Testen Sie Ihre Wunschkombination live (inkl. E-Auto, Oldtimer, Saison-Zeiträumen & 3D-Optik) und übernehmen Sie diese direkt in Ihren Termin.",
                "calc_title": "Schnell-Kalkulator & Extras",
                "calc_desc": "Wählen Sie Ihre gewünschten Leistungen & Zusatzoptionen für Ihren Termin:"
            },
            "checklist": {
                "title": "Dokumenten-Check vorab",
                "desc": "Haken Sie ab, was Sie bereits vorliegen haben – so geht vor Ort bei uns alles in wenigen Minuten:",
                "item_1": "Zulassungsbescheinigung Teil I & II (Schein & Brief im Original)",
                "item_2": "Gültiger Personalausweis oder Reisepass mit Meldebescheinigung",
                "item_3": "7-stellige eVB-Nummer Ihrer Kfz-Versicherung",
                "item_4": "Gültiger TÜV / HU-Bericht & IBAN für das SEPA-Mandat",
                "item_5": "Unterschriebene Vollmacht (auch digital hier oder vor Ort ausfüllbar!)"
            },
            "faq": {
                "title": "Häufige Fragen (Berlin FAQ)",
                "q1": "1. Wie schnell bekomme ich meine Zulassung?",
                "a1": "In der Regel dauert die reguläre Anmeldung beim LABO Berlin 1–2 Werktage. Mit unserem Express-Service sowie bei Kurzzeit- und Sofortkennzeichen oft noch am selben Tag!",
                "q2": "2. Prägt ihr die Kennzeichenschilder direkt vor Ort?",
                "a2": "Ja! In unserem Büro in der Kienitzer Str. 6 (12053 Berlin) prägen wir Ihre neuen Euro-, E-, Saison-, Kurzzeit- oder Zollkennzeichen sofort zum Mitnehmen.",
                "q3": "3. Muss ich die Formulare vorher zu Hause ausdrucken?",
                "a3": "Nein, nicht zwingend. Sie können unsere digitale Vollmacht direkt online ausfüllen oder alle Vordrucke ganz entspannt bei der Abgabe in unserem Büro unterschreiben.",
                "q4": "4. Brauche ich selbst einen Termin bei der Zulassungsstelle (LABO)?",
                "a4": "Nein! Als eingetragener Berliner Zulassungsdienst verfügen wir über direkte Behördenkontingente. Sie buchen nur Ihren kurzen Abgabetermin bei uns – den Behördengang erledigen wir komplett für Sie.",
                "q5": "5. Kann auch eine andere Person meine Papiere bei euch abgeben?",
                "a5": "Ja, jederzeit. Wichtig ist nur, dass die Vollmacht und das SEPA-Lastschriftmandat vom zukünftigen Fahrzeughalter unterschrieben sind und dessen Original-Ausweis vorliegt.",
                "q6": "6. Was passiert, wenn mein TÜV abgelaufen ist oder Papiere fehlen?",
                "a6": "Kein Problem: Für Fahrten zum TÜV können wir Ihnen ein Kurzzeitkennzeichen erstellen. Bei verlorenen Papieren (Schein/Brief) helfen wir Ihnen sofort mit der amtlichen Verlusterklärung und Ersatzbeantragung."
            },
            "termin": {
                "title": "Wunschtermin Buchen",
                "desc": "Schnelle Abgabe ohne Wartezeit • Ansprechpartner: <strong>Tamer Yazici</strong>"
            },
            "formulare": {
                "title": "Formulare & Anträge",
                "desc": "Alle wichtigen Zulassungsformulare und Anträge in der Übersicht"
            },
            "ankauf": {
                "title": "AUTO ANKAUF",
                "subtitle": "Jeglicher Art – Sofort Bargeld!",
                "desc": "Faire Bewertung, diskrete Abwicklung und sofortige Barauszahlung direkt vor Ort. Inklusive kostenloser Abmeldung Ihres Fahrzeugs.",
                "sign": "Ty"
            },
            "legal": {
                "datenschutz_extra": "Sämtliche Terminbuchungsdaten werden nach DSGVO-Standard verschlüsselt übertragen und ausschließlich zur Durchführung Ihrer Kfz-Zulassung verwendet. Eine Weitergabe an unbefugte Dritte erfolgt nicht."
            },
            "footer": {
                "text": `© ${window.getDynamicSystemYear()} RED Zulassungsdienst Berlin. Inhaber: Tamer Yazici.`
            }
        };

        window.renderHeaderBrandWordmark = function(redText, subText) {
            const redEl = document.getElementById('txt-header-title-red');
            const subEl = document.getElementById('txt-header-title-sub');

            if (redEl) {
                const cleanRed = String(redText || 'RED').trim();
                if (cleanRed.toUpperCase() === 'RED') {
                    redEl.innerHTML = `<svg class="logo-red-svg" viewBox="0 0 134 28" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RED"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 2 H29 C36.2 2 40 5.1 40 10.2 C40 14.4 37.2 17.1 32 17.8 L40.5 26 H30.4 L22.2 18 H8 V26 H0 V4 C0 2.8 0.8 2 2 2 Z M8 7 V13 H27.2 C30.1 13 31.8 11.8 31.8 10 C31.8 8.2 30.1 7 27.2 7 Z" fill="var(--primary-red)"/><path d="M55 2 H85 V7.2 H56.2 C53.2 7.2 52.8 8.6 52.8 10.2 V11.5 H82 V16.5 H52.8 V17.8 C52.8 19.4 53.2 20.8 56.2 20.8 H85 V26 H55 C48.2 26 45 22.4 45 17.2 V10.8 C45 5.6 48.2 2 55 2 Z" fill="var(--primary-red)"/><path fill-rule="evenodd" clip-rule="evenodd" d="M93 2 H119 C128 2 133 6.8 133 14 C133 21.2 128 26 119 26 H91 V4 C91 2.8 91.8 2 93 2 Z M98.8 7.2 V20.8 H118.2 C122.6 20.8 125 18.2 125 14 C125 9.8 122.6 7.2 118.2 7.2 Z" fill="var(--primary-red)"/></svg>`;
                } else {
                    redEl.innerText = cleanRed;
                }
            }

            if (subEl) {
                let cleanSub = String(subText || 'ZULASSUNGSDIENST & SCHILDER').trim();
                if (cleanSub.toUpperCase() === 'ZULASSUNGSDIENST') {
                    cleanSub = 'ZULASSUNGSDIENST & SCHILDER';
                }
                if (cleanSub.includes('&')) {
                    const parts = cleanSub.split('&');
                    const line1 = window.escHtml(parts[0].trim());
                    const line2 = window.escHtml(parts.slice(1).join('&').trim());
                    subEl.innerHTML = `<span>${line1}</span><span class="logo-sub-line2"><span class="logo-amp">&amp;</span>${line2}</span>`;
                } else {
                    subEl.innerText = cleanSub;
                }
            }
        };

window.renderHeaderCarIcon = function(carType, carAnim, carColor) {
            const wrapper = document.getElementById('headerCarDisplayWrapper');
            if(!wrapper) return;
            wrapper.className = carAnim || 'car-anim-idle';
            wrapper.style.color = carColor || 'var(--text-light)';

            if(!carType || carType === 'svg-sport') {
                wrapper.innerHTML = `<svg class="logo-car-svg" viewBox="8 0 444 132" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="hdrFrontBeam" x1="376" y1="78" x2="450" y2="86" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--car-front-light)" stop-opacity="0.52"/><stop offset="100%" stop-color="var(--car-front-light)" stop-opacity="0"/></linearGradient><linearGradient id="hdrRearGlow" x1="42" y1="63" x2="10" y2="63" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="var(--car-rear-light)" stop-opacity="0.52"/><stop offset="100%" stop-color="var(--car-rear-light)" stop-opacity="0"/></linearGradient></defs><path class="logo-car-taillight-glow" d="M40 57 L10 51 L10 75 L41 68 Z" fill="url(#hdrRearGlow)"/><path class="logo-car-headlight-beam" d="M374 75 L450 58 L450 108 L382 86 Z" fill="url(#hdrFrontBeam)"/><path d="M40 50 C76 41, 118 21, 168 17 C210 14, 244 26, 276 49 L284 47 C324 48, 362 58, 393 84 C396 87, 396 90, 392 94 C388 99, 386 105, 391 110 C392 112, 390 114, 385 114 C376 114, 366 112, 356 110 C366 109, 376 109, 384 108 C380 103, 382 95, 389 87 C359 64, 321 55, 274 54 C242 32, 208 22, 168 24 C122 27, 82 45, 44 52 Z" fill="currentColor"/><path d="M108 42 C136 29, 174 25, 206 29 C226 32, 244 41, 260 53 L254 54 C238 43, 222 36, 203 33 C174 30, 140 34, 116 44 C128 50, 144 53, 162 54 C194 55, 226 55, 256 54 L254 57 C222 58, 188 57, 156 56 C135 55, 118 51, 108 42 Z" fill="currentColor"/><path d="M148 33 L154 55 L151 55 L145 34 Z" fill="currentColor" opacity="0.75"/><path d="M40 52 C68 47, 102 47, 136 60 C104 52, 70 53, 44 57 Z" fill="currentColor"/><path d="M40 52 C46 58, 48 67, 48 77 C48 82, 42 84, 36 84 C37 94, 45 103, 55 108 C42 106, 32 95, 31 82 C31 79, 34 77, 38 76 C36 73, 35 68, 38 63 C40 60, 40 56, 38 52 Z" fill="currentColor"/><path class="logo-car-taillight" d="M39 57 C44 58, 47 62, 46 68 C42 68, 38 66, 36 62 C36 59, 37 57, 39 57 Z"/><path d="M146 56 C139 67, 141 82, 154 97 C144 82, 143 68, 149 56 Z" fill="currentColor" opacity="0.85"/><path d="M158 72 C202 74, 248 77, 286 78 C293 78, 297 76, 292 74 C284 73, 276 74, 268 75 C234 74, 196 72, 158 72 Z" fill="currentColor"/><path d="M262 58 C266 72, 265 88, 260 100 C263 87, 264 72, 260 58 Z" fill="currentColor" opacity="0.7"/><path d="M138 103 C186 104, 238 105, 284 108 L284 114 C238 110, 186 106, 138 104 Z" fill="currentColor"/><path d="M126 117 C178 114, 232 115, 284 119 C232 118, 178 118, 126 117 Z" fill="currentColor" opacity="0.85"/><path d="M55 104 C55 68, 72 60, 92 60 C114 60, 128 74, 129 102 C125 79, 112 67, 92 67 C73 67, 61 78, 59 104 Z" fill="currentColor"/><path d="M284 103 C284 72, 300 60, 320 60 C342 60, 355 74, 356 105 C352 79, 340 67, 320 67 C301 67, 290 79, 288 103 Z" fill="currentColor"/><circle cx="92" cy="96" r="22.5" stroke="currentColor" stroke-width="2.7" fill="none"/><path d="M92 96 C95 89, 98 83, 102 78 C99 84, 97 90, 95 96 Z M92 96 C85 95, 79 96, 73 99 C79 94, 85 93, 92 93 Z M94 97 C100 98, 105 99, 111 98 C105 101, 99 101, 94 99 Z M91 98 L85 106 L88 97 Z" fill="currentColor"/><circle cx="320" cy="96" r="22.5" stroke="currentColor" stroke-width="2.7" fill="none"/><path d="M320 96 C323 89, 326 83, 330 78 C327 84, 325 90, 323 96 Z M320 96 C313 95, 307 96, 301 99 C307 94, 313 93, 320 93 Z M322 97 C328 98, 333 99, 339 98 C333 101, 327 101, 322 99 Z M319 98 L313 106 L316 97 Z" fill="currentColor"/><path class="logo-car-headlight" d="M346 69 C361 72, 373 78, 383 85 C370 84, 356 78, 346 72 Z"/><path d="M343 72 C356 79, 370 84, 384 86 C370 86, 355 81, 342 73 Z" fill="currentColor" opacity="0.8"/><path d="M366 111 C368 99, 374 92, 384 92 C376 95, 371 101, 370 109 L384 111 Z" fill="currentColor"/><path d="M354 117 C368 117, 380 115, 388 112 C380 117, 368 119, 354 117 Z" fill="currentColor"/></svg>`;
            } else {
                wrapper.innerHTML = `<i class="fa-solid ${carType} logo-car-icon"></i>`;
            }
        };

        window.applyPageContent = function(data) {
            if(!data) return;
            for (const sec in data) {
                window.pageContentData[sec] = Object.assign(window.pageContentData[sec] || {}, data[sec]);
            }
            
            const d = window.pageContentData;
            if(d.header) {
                window.renderHeaderBrandWordmark(d.header.title_red, d.header.title_sub);                
                if(document.getElementById('txt-header-crm')) document.getElementById('txt-header-crm').innerText = d.header.txt_crm;
                if(document.getElementById('icon-header-crm')) document.getElementById('icon-header-crm').className = "fa-solid " + d.header.icon_crm;
                if(document.getElementById('txt-header-visitors')) document.getElementById('txt-header-visitors').innerText = d.header.txt_visitors + " ";
                if(document.getElementById('icon-header-visitors')) document.getElementById('icon-header-visitors').className = "fa-solid " + d.header.icon_visitors;
                window.renderHeaderCarIcon(d.header.icon_car, d.header.car_anim, d.header.car_color);
            }
            if(d.hero) {
                if(document.getElementById('txt-hero-badge')) document.getElementById('txt-hero-badge').innerText = d.hero.badge;
                if(document.getElementById('txt-hero-h1-1')) document.getElementById('txt-hero-h1-1').innerText = d.hero.h1_1;
                if(document.getElementById('txt-hero-h1-2')) document.getElementById('txt-hero-h1-2').innerText = d.hero.h1_2;
                if(document.getElementById('txt-hero-desc')) document.getElementById('txt-hero-desc').innerText = d.hero.desc;
            }
            if(d.leistungen) {
                if(document.getElementById('txt-leist-title')) document.getElementById('txt-leist-title').innerText = d.leistungen.title;
                if(document.getElementById('txt-leist-desc')) document.getElementById('txt-leist-desc').innerText = d.leistungen.desc;
            }
            if(d.tools) {
                if(document.getElementById('txt-wk-title')) document.getElementById('txt-wk-title').innerText = d.tools.wk_title;
                if(document.getElementById('txt-wk-desc')) document.getElementById('txt-wk-desc').innerText = d.tools.wk_desc;
                if(document.getElementById('txt-calc-title')) document.getElementById('txt-calc-title').innerText = d.tools.calc_title;
                if(document.getElementById('txt-calc-desc')) document.getElementById('txt-calc-desc').innerText = d.tools.calc_desc;
            }
            if(d.checklist) {
                if(document.getElementById('txt-check-title')) document.getElementById('txt-check-title').innerText = d.checklist.title;
                if(document.getElementById('txt-check-desc')) document.getElementById('txt-check-desc').innerText = d.checklist.desc;
                for(let i=1; i<=5; i++) {
                    if(document.getElementById('txt-check-'+i) && d.checklist['item_'+i]) {
                        document.getElementById('txt-check-'+i).innerText = d.checklist['item_'+i];
                    }
                }
            }
            if(d.faq) {
                if(document.getElementById('txt-faq-title')) document.getElementById('txt-faq-title').innerText = d.faq.title;
                for(let i=1; i<=6; i++) {
                    if(document.getElementById('txt-faq-q'+i) && d.faq['q'+i]) document.getElementById('txt-faq-q'+i).innerText = d.faq['q'+i];
                    if(document.getElementById('txt-faq-a'+i) && d.faq['a'+i]) document.getElementById('txt-faq-a'+i).innerText = d.faq['a'+i];
                }
            }
            if(d.termin) {
                if(document.getElementById('txt-termin-title')) document.getElementById('txt-termin-title').innerText = d.termin.title;
                if(document.getElementById('txt-termin-desc')) document.getElementById('txt-termin-desc').innerHTML = d.termin.desc;
            }
            if(d.formulare) {
                if(document.getElementById('txt-form-title')) document.getElementById('txt-form-title').innerText = d.formulare.title;
                if(document.getElementById('txt-form-desc')) document.getElementById('txt-form-desc').innerText = d.formulare.desc;
            }
            if(d.ankauf) {
                if(document.getElementById('txt-ankauf-title')) document.getElementById('txt-ankauf-title').innerText = d.ankauf.title;
                if(document.getElementById('txt-ankauf-subtitle')) document.getElementById('txt-ankauf-subtitle').innerText = d.ankauf.subtitle;
                if(document.getElementById('txt-ankauf-desc')) document.getElementById('txt-ankauf-desc').innerText = d.ankauf.desc;
                if(document.getElementById('txt-ankauf-sign')) document.getElementById('txt-ankauf-sign').innerText = d.ankauf.sign;
            }
            if(d.footer) {
                if(document.getElementById('txt-footer-text')) document.getElementById('txt-footer-text').innerText = d.footer.text;
            }
        };

        // --- LEISTUNGSKARTEN ---
        const defaultServices = [
            { id: "s-1", icon: "fa-file-signature", title: "Anmeldung (Wunsch)", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "100", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "badge-topseller", desc: "Inkl. Gebühren, Wunschkennz. & Plakette.", descAnim: "", hoverInfo: "Komplettpreis: 100 € inkl. Gebühren, Schilder & Plakette.\nMitzubringen (Original):\n• Brief & Schein • Ausweis\n• TÜV-Bericht • eVB-Nr. • IBAN", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-2", icon: "fa-car", title: "Anmeldung (Zufall)", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "90", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "", desc: "Listenkennz. inkl. Gebühren, Schilder & Plakette.", descAnim: "", hoverInfo: "Komplettpreis: 90 € inkl. Gebühren, Schilder & Plakette.\nMitzubringen (Original):\n• Brief & Schein • Ausweis\n• TÜV-Bericht • eVB-Nr. • IBAN", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-3", icon: "fa-exchange-alt", title: "Ummeldung", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "70", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "", desc: "Mit gleichem Kennzeichen (angemeldet).", descAnim: "", hoverInfo: "Ummeldung mit Kennzeichenübernahme.\nMitzubringen (Original):\n• Fahrzeugpapiere I & II\n• Ausweis / Pass • eVB-Nr.\n• Gültige HU / AU • IBAN", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-4", icon: "fa-file-circle-xmark", title: "Abmeldung", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "30", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "", desc: "Regulär 30 € • Online-Abmeldung 20 €.", descAnim: "", hoverInfo: "Vor Ort 30 € • Online-Abmeldung 20 €.\nMitzubringen (Original):\n• Zulassungsbescheinigung I\n• Bisherige Kennzeichen", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-5", icon: "fa-laptop", title: "Online-Abmeldung", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "20", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "badge-neu", desc: "Schnelle digitale Außerbetriebsetzung.", descAnim: "", hoverInfo: "Digitale Sofort-Stilllegung (20 €).\nBenötigt:\n• Fahrzeugschein (ZB I) mit Sicherheitscode\n• Kennzeichen mit Sicherheitscodes", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-6", icon: "fa-stopwatch", title: "Kurzzeitkennz.", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "120", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "", desc: "6 Tage Gültigkeit – schnelle Abwicklung.", descAnim: "", hoverInfo: "Kurzzeitkennzeichen für 6 Tage.\nMitzubringen (Original):\n• Ausweis / Pass • eVB für Kurzzeit\n• Fahrzeugpapiere • Gültige HU", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-7", icon: "fa-globe", title: "Zollkennzeichen", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "350", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-gold-3d", badge: "badge-topseller", desc: "30 Tage Gültigkeit für den Export.", descAnim: "anim-pulse", hoverInfo: "Ausfuhr-/Zollkennzeichen für 30 Tage.\nMitzubringen (Original):\n• Ausweis / Pass • Fahrzeugpapiere\n• Gültige HU • Gelbe Versicherungskarte", borderSize: "1px", borderColor: "var(--glass-border)" },
            { id: "s-8", icon: "fa-id-card", title: "Kennzeichenprägung", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "30", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-standard", badge: "", desc: "1 Paar 30 € • Einzelstück 15 € sofort vor Ort.", descAnim: "", hoverInfo: "Sofortprägung vor Ort (3–5 Min.):\n• 1 Paar (2 Stück): 30 € • 1 Stück: 15 €\n• Euro-, Kurz-, E-, H-, Saison- & Motorradschilder", borderSize: "1px", borderColor: "var(--glass-border)" }
            // Optional bei Bedarf aktivieren:
            // ,{ id: "s-9", icon: "fa-bolt", title: "Express Zulassung", titleColor: "var(--text-light)", titleFont: "'Montserrat', sans-serif", titleSize: "18px", price: "300", priceColor: "var(--primary-red)", iconColor: "var(--primary-red)", euroStyle: "euro-neon-blue", badge: "badge-express-tipp", desc: "Priorisierte Abwicklung.", descAnim: "", hoverInfo: "Express Service (300 €):\nPriorisierte Abwicklung nach Absprache.", borderSize: "1px", borderColor: "var(--glass-border)" }
        ];

        window.servicesData = JSON.parse(localStorage.getItem('red_services_v4')) || defaultServices;

        const badgeLabels = {
            "badge-neu": "NEU", "badge-angebot": "ANGEBOT", "badge-aktion": "AKTION", 
            "badge-topseller": "TOPSELLER", "badge-kurze-zeit": "NUR KURZE ZEIT", 
            "badge-ostern": "OSTERN-SPECIAL", "badge-express-tipp": "EXPRESS TIPP"
        };

        window.applyContactInfo = function(data) {
            if(!data) return;
            window.dynamicContactData = {
                ...data,
                webhook: (data.webhook || '').trim() || window.DEFAULT_MAKE_WEBHOOK
            };
            document.querySelectorAll('.live-phone').forEach(el => el.innerText = data.phone);
            document.querySelectorAll('.live-email').forEach(el => el.innerText = data.email);
            const igEl = document.getElementById('link-ig');
            const fbEl = document.getElementById('link-fb');
            const igVal = (data.ig || '').trim();
            const fbVal = (data.fb || '').trim();
            if (igEl) {
                igEl.href = igVal || '#';
                igEl.style.display = (igVal && igVal !== '#') ? 'flex' : 'none';
            }
            if (fbEl) {
                fbEl.href = fbVal || '#';
                fbEl.style.display = (fbVal && fbVal !== '#') ? 'flex' : 'none';
            }
            let waPhone = data.phone.replace(/\D/g,'');
            if(waPhone.startsWith('0')) waPhone = '49' + waPhone.substring(1);
            const telLink = document.getElementById('tel-contact-link');
            if(telLink && waPhone) telLink.href = "tel:+" + waPhone;
            document.getElementById('wa-contact-btn').href = "https://wa.me/" + waPhone;
            document.getElementById('menu-wa-link').href = "https://wa.me/" + waPhone;
            if(document.getElementById('fab-wa-link')) document.getElementById('fab-wa-link').href = "https://wa.me/" + waPhone;
            document.getElementById('email-contact-btn').href = "mailto:" + data.email;
        };

        window.renderServices = function(data) {
            const grid = document.getElementById('servicesGridContainer');
            const selectDropdown = document.getElementById('serviceSelectDropdown');
            if(!grid || !selectDropdown) return;
            grid.innerHTML = '';
            selectDropdown.innerHTML = '';
            
            data.forEach(srv => {
                let badgeHtml = '';
                if(srv.badge && badgeLabels[srv.badge]) {
                    badgeHtml = `<div class="card-badge ${srv.badge}">${badgeLabels[srv.badge]}</div>`;
                }
                
                const hoverHtml = (srv.hoverInfo || '').replace(/\n/g, '<br>');
                const displayPrice = (!srv.price || srv.price.trim() === '') ? '-' : srv.price;

                const card = document.createElement('div');
                card.className = 'card';
                card.style.border = `${srv.borderSize || '1px'} solid ${srv.borderColor || 'var(--glass-border)'}`;
                card.setAttribute('onclick', 'window.toggleCardSlide(this, event)');
                
                let titleCol = srv.titleColor === '#ffffff' ? 'var(--text-light)' : srv.titleColor;

                card.innerHTML = `
                    <div class="admin-action-btn btn-edit-green action-prices" style="z-index:25; pointer-events:auto;" onclick="event.stopPropagation(); window.openServiceConfig('${srv.id}')" title="Leistungskarte mit Stift bearbeiten"><i class="fa-solid fa-pencil"></i></div>
                    <div class="admin-action-btn btn-del-red action-prices" style="z-index:25; pointer-events:auto;" onclick="event.stopPropagation(); window.deleteServiceCard('${srv.id}')" title="Karte löschen"><i class="fa-solid fa-trash"></i></div>
                    ${badgeHtml}
                    <i class="fa-solid ${srv.icon} main-icon" style="color: ${srv.iconColor || 'var(--primary-red)'};"></i>
                    <h3 style="color:${titleCol || 'var(--text-light)'}; font-family:${srv.titleFont || "'Montserrat', sans-serif"}; font-size:${srv.titleSize || '18px'}; margin-bottom:0;">${srv.title}</h3>
                    <div class="price-wrapper">
                        ${displayPrice === '-'
                            ? `<span style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.6px; background:var(--bg-input); padding:4px 12px; border-radius:20px; border:1px solid var(--glass-border);">Preis auf Anfrage</span>`
                            : `<span class="service-price" style="color:${srv.priceColor || 'var(--primary-red)'};">${displayPrice}</span><span class="service-price ${srv.euroStyle}" style="font-size:24px;">€</span>`
                        }
                    </div>
                    <p class="${srv.descAnim}" style="font-size:11px; color:var(--text-muted); margin-top:4px; pointer-events:none;">${srv.desc}</p>
                    <div class="card-info-slide">
                        <p>${hoverHtml}</p>
                        <button type="button" class="card-slide-book-btn" onclick="event.stopPropagation(); window.bookServiceFromCard('${srv.id}')">Termin wählen <i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                `;
                grid.appendChild(card);

                const opt = document.createElement('div');
                opt.className = 'noble-option';
                opt.setAttribute('data-value', srv.title);
                opt.innerText = srv.title;
                opt.onclick = (e) => {
                    e.stopPropagation();
                    window.selectedServiceVal = srv.title;
                    document.getElementById('selectTriggerText').innerText = srv.title;
                    document.getElementById('serviceSelectBox').classList.remove('open');
                    window.updateBookingLiveSummary();
                };
                selectDropdown.appendChild(opt);
            });
        };

        window.renderCustomBlocks = function(blocksData) {
            document.querySelectorAll('.dynamic-block-container').forEach(c => c.innerHTML = '');
            
            blocksData.sort((a,b) => b.timestamp - a.timestamp).forEach(block => {
                const container = document.getElementById('dynamic-client-section-' + block.page);
                if(!container) return;

                let mediaHtml = '';
                if(block.mediaUrl) {
                    if(block.mediaUrl.includes('video/') || block.mediaUrl.endsWith('.mp4') || block.mediaUrl.startsWith('data:video')) {
                        mediaHtml = `<video src="${block.mediaUrl}" controls autoplay loop playsinline class="dynamic-block-media"></video>`;
                    } else {
                        mediaHtml = `<img src="${block.mediaUrl}" class="dynamic-block-media" loading="lazy" decoding="async" alt="${window.escHtml(block.title)}">`;
                    }
                }

                let bannerHtml = '';
                if(block.bannerText) {
                    const emoji = block.bannerEmoji ? `<span class="pulse-emoji">${block.bannerEmoji}</span> ` : '';
                    bannerHtml = `
                        <div style="background:${block.bannerColor || 'var(--primary-red)'}; color:#fff; padding:8px 20px; border-radius:50px; display:inline-flex; align-items:center; font-weight:900; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px; box-shadow:0 5px 15px rgba(0,0,0,0.3);">
                            ${emoji}${block.bannerText}${emoji ? ' ' + emoji.replace('style="margin-right:8px;"', 'style="margin-left:8px;"') : ''}
                        </div>
                    `;
                }

                const blockEl = document.createElement('div');
                blockEl.className = 'dynamic-block-inner';
                blockEl.style.border = `${block.borderSize || '1px'} solid ${block.borderColor || 'var(--primary-red)'}`;
                blockEl.style.position = 'relative';

                blockEl.innerHTML = `
                    <div class="admin-action-btn btn-edit-green action-blocks" onclick="window.openEditBlock('${block.id}')" title="Baustein bearbeiten"><i class="fa-solid fa-pencil"></i></div>
                    <div class="admin-action-btn btn-del-red action-blocks" onclick="window.deleteCustomBlock('${block.id}')" title="Baustein löschen"><i class="fa-solid fa-trash-can"></i></div>
                    ${bannerHtml}
                    <h2 style="color:${block.titleColor || 'var(--primary-red)'}; font-family:${block.titleFont || "'Montserrat', sans-serif"}; font-size:${block.titleSize || 'clamp(20px, 3vw, 28px)'}; margin-bottom:15px;">
                        ${block.icon ? `<i class="${block.icon.includes('fa-') ? block.icon : 'fa-solid ' + block.icon}" style="margin-right:8px;"></i>` : ''}${block.title}
                    </h2>
                    <p style="color:${block.textColor === '#cccccc' ? 'var(--text-light)' : (block.textColor || 'var(--text-light)')}; font-family:${block.textFont || "'Montserrat', sans-serif"}; font-size:${block.textSize || '14px'}; line-height:1.8; margin-bottom:15px; white-space:pre-wrap;">${block.text}</p>
                    ${mediaHtml}
                `;
                container.appendChild(blockEl);
            });
        };

        window.applyAdminModulePermissions = function(perms) {
            if(!perms) perms = { leads: true, prices: true, customblocks: true, content: true, companydata: true, forms: true, cars: true, ticker: true, crm: true, pages: true, theme: true, invoice: false, shopgallery: false };
            const allowInvoice = perms.invoice === true;
            const allowShopGallery = perms.shopgallery === true;
            const allowVideos = perms.videos === true;
            window.adminPermissions = { ...perms, invoice: allowInvoice, shopgallery: allowShopGallery, videos: allowVideos };
            if(!window.loggedInUser) return;
            
            if(document.getElementById('permLeads')) {
                document.getElementById('permLeads').checked = perms.leads;
                document.getElementById('permPrices').checked = perms.prices;
                document.getElementById('permCustomblocks').checked = perms.customblocks;
                document.getElementById('permContent').checked = perms.content;
                document.getElementById('permCompanydata').checked = perms.companydata;
                document.getElementById('permForms').checked = perms.forms;
                document.getElementById('permCars').checked = perms.cars;
                document.getElementById('permTicker').checked = perms.ticker;
                document.getElementById('permCrm').checked = perms.crm;
                document.getElementById('permPages').checked = perms.pages;
                document.getElementById('permTheme').checked = perms.theme;
                if(document.getElementById('permInvoice')) document.getElementById('permInvoice').checked = allowInvoice;
                if(document.getElementById('permShopgallery')) document.getElementById('permShopgallery').checked = allowShopGallery;
                if(document.getElementById('permVideos')) document.getElementById('permVideos').checked = allowVideos;
                window.updateSupervisorPermCounter();
            }

            document.body.classList.toggle('perm-leads', perms.leads);
            document.body.classList.toggle('perm-prices', perms.prices);
            document.body.classList.toggle('perm-blocks', perms.customblocks);
            document.body.classList.toggle('perm-content', perms.content);
            document.body.classList.toggle('perm-data', perms.companydata);
            document.body.classList.toggle('perm-forms', perms.forms);
            document.body.classList.toggle('perm-cars', perms.cars);
            document.body.classList.toggle('perm-ticker', perms.ticker);
            document.body.classList.toggle('perm-crm', perms.crm);
            document.body.classList.toggle('perm-pages', perms.pages);
            document.body.classList.toggle('perm-theme', perms.theme);
            document.body.classList.toggle('perm-invoice', allowInvoice);
            document.body.classList.toggle('perm-shopgallery', allowShopGallery);
            document.body.classList.toggle('perm-videos', allowVideos);
            if (typeof window.renderShopGallery === 'function') window.renderShopGallery();
            setTimeout(window.syncHeaderHeight, 80);
        };

        // --- RED KUNDEN (CRM) FUNKTIONEN ---
        window.openCRM = function() {
            document.getElementById('crmOverlay').classList.add('open');
            window.renderCRM();
        };

        window.closeCRM = function() {
            document.getElementById('crmOverlay').classList.remove('open');
        };

        window.printCRM = function() { window.print(); };

        window.createNewCRMClientManual = function() {
            let maxIdNumber = 0;
            for (let key in window.crmClientsDetail) {
                let client = window.crmClientsDetail[key];
                if (client.clientId && client.clientId.startsWith('RED-')) {
                    let numVal = parseInt(client.clientId.replace(/\D/g, ''), 10);
                    if (!isNaN(numVal) && numVal > maxIdNumber) maxIdNumber = numVal;
                }
            }
            maxIdNumber++;
            let paddedNum = maxIdNumber.toString().padStart(9, '0');
            let formattedNum = paddedNum.replace(/(\d{3})(?=\d)/g, '$1 ');
            const newId = 'RED-' + formattedNum;

            document.getElementById('crmEditClientId').value = newId;
            document.getElementById('crmEditClientIdView').value = newId;
            if(document.getElementById('crmEditCategory')) document.getElementById('crmEditCategory').value = 'Privatkunde';
            document.getElementById('crmEditName').value = '';
            document.getElementById('crmEditPhone').value = '';
            document.getElementById('crmEditEmail').value = '';
            document.getElementById('crmEditBirthday').value = '';
            document.getElementById('crmEditAddress').value = '';
            document.getElementById('crmEditCity').value = '';
            document.getElementById('crmEditNotes').value = '';
            document.getElementById('crmDetailOverlay').classList.add('open');
        };

        window.exportCRMToCSV = function() {
            const clients = Object.values(window.crmClientsDetail || {});
            if(clients.length === 0) {
                window.showToast('Keine Kundendaten zum Exportieren vorhanden.', 'error');
                return;
            }
            let csv = '\uFEFFKunden-ID;Name;Kategorie;Telefon;E-Mail;Geburtstag;Adresse;PLZ/Ort;Notizen;Buchungen;Registriert am\n';
            clients.forEach(c => {
                const reg = c.timestamp ? new Date(c.timestamp).toLocaleDateString('de-DE') : '-';
                const clean = (val) => `"${String(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
                csv += `${clean(c.clientId)};${clean(c.name)};${clean(c.category || 'Privatkunde')};${clean(c.phone)};${clean(c.email)};${clean(c.birthday)};${clean(c.address)};${clean(c.city)};${clean(c.notes)};${c.bookings || 1};${reg}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RED_Kundendatenbank_${new Date().toLocaleDateString('de-DE')}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.showToast('CSV-Datei erfolgreich exportiert!', 'success');
        };

        window.rebookClient = function(clientId) {
            const client = window.crmClientsDetail[clientId];
            if(!client) return;
            window.closeCRM();
            window.closeAdmin();
            window.switchView('view-home');
            setTimeout(() => {
                document.getElementById('termin').scrollIntoView({behavior: 'smooth'});
                document.getElementById('formName').value = client.name || '';
                document.getElementById('formPhone').value = client.phone || '';
                document.getElementById('formEmail').value = client.email || '';
                window.updateBookingLiveSummary();
                window.showToast('Kunde geladen. Bitte Wunschtermin wählen.', 'success');
            }, 600);
        };

        window.openCRMDetail = function(clientId) {
            const detail = window.crmClientsDetail[clientId] || {};
            document.getElementById('crmEditClientId').value = clientId;
            document.getElementById('crmEditClientIdView').value = clientId !== 'N/A' ? clientId : 'Nicht vergeben';
            if(document.getElementById('crmEditCategory')) document.getElementById('crmEditCategory').value = detail.category || 'Privatkunde';
            document.getElementById('crmEditName').value = detail.name !== 'undefined' ? (detail.name || '') : '';
            document.getElementById('crmEditPhone').value = detail.phone !== 'undefined' ? (detail.phone || '') : '';
            document.getElementById('crmEditEmail').value = detail.email !== 'undefined' ? (detail.email || '') : '';

            document.getElementById('crmEditBirthday').value = detail.birthday || '';
            document.getElementById('crmEditAddress').value = detail.address || '';
            document.getElementById('crmEditCity').value = detail.city || '';
            document.getElementById('crmEditNotes').value = detail.notes || '';

            document.getElementById('crmDetailOverlay').classList.add('open');
        };

        window.closeCRMDetail = function() { document.getElementById('crmDetailOverlay').classList.remove('open'); };

        window.crmCategoryFilter = 'all';
        window.crmSortMode = 'newest';

        window.setCrmCategoryFilter = function(catKey) {
            window.crmCategoryFilter = catKey || 'all';
            document.querySelectorAll('#crmCatPills .crm-cat-pill').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-cat') === window.crmCategoryFilter);
            });
            window.renderCRM();
        };

        window.changeCrmSort = function(mode) {
            window.crmSortMode = mode || 'newest';
            window.renderCRM();
        };

        window.renderCRM = function() {
            const list = document.getElementById('crmList');
            if(!list) return;
            list.innerHTML = '';
            
            const allClients = Object.values(window.crmClientsDetail || {});
            const vipCount = allClients.filter(c => (c.bookings || 1) > 1 || (c.category && c.category.includes('VIP'))).length;
            const businessCount = allClients.filter(c => c.category && (c.category.includes('Gewerbe') || c.category.includes('Händler'))).length;
            const totalBookings = allClients.reduce((acc, c) => acc + (Number(c.bookings) || 1), 0);

            if(document.getElementById('kpiTotalCrm')) document.getElementById('kpiTotalCrm').innerText = allClients.length;
            if(document.getElementById('crmStatTotal')) document.getElementById('crmStatTotal').innerText = allClients.length;
            if(document.getElementById('crmStatVip')) document.getElementById('crmStatVip').innerText = vipCount;
            if(document.getElementById('crmStatBusiness')) document.getElementById('crmStatBusiness').innerText = businessCount;
            if(document.getElementById('crmStatBookings')) document.getElementById('crmStatBookings').innerText = totalBookings;

            const q = (document.getElementById('crmSearch')?.value || '').trim().toLowerCase();
            const catFilter = window.crmCategoryFilter || 'all';

            let clients = allClients.filter(c => {
                const catStr = String(c.category || 'Privatkunde');
                let catMatch = true;
                if (catFilter === 'VIP') catMatch = catStr.includes('VIP') || (Number(c.bookings) || 1) > 1;
                else if (catFilter !== 'all') catMatch = catStr.toLowerCase().includes(catFilter.toLowerCase());

                const searchHay = `${c.clientId || ''} ${c.name || ''} ${c.phone || ''} ${c.email || ''} ${catStr} ${c.notes || ''}`.toLowerCase();
                return catMatch && (!q || searchHay.includes(q));
            });

            if (window.crmSortMode === 'bookings') {
                clients.sort((a, b) => (Number(b.bookings) || 1) - (Number(a.bookings) || 1));
            } else if (window.crmSortMode === 'name') {
                clients.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
            } else {
                clients.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }
            
            if(clients.length === 0) {
                list.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:var(--text-muted);">Keine passenden Kunden gefunden.</td></tr>';
                return;
            }
            
            clients.forEach(c => {
                const cleanDigits = (c.phone || '').replace(/\D/g, '');
                const waLink = cleanDigits ? `https://wa.me/${cleanDigits.replace(/^0/, '49')}` : '#';
                const regDate = c.timestamp ? new Date(c.timestamp).toLocaleDateString('de-DE') : '-';
                const catStr = c.category || 'Privatkunde';
                let catClass = '';
                if (catStr.includes('VIP')) catClass = 'cat-vip';
                else if (catStr.includes('Gewerbe')) catClass = 'cat-gewerbe';
                else if (catStr.includes('Händler')) catClass = 'cat-haendler';

                const lastNoteLine = c.notes ? String(c.notes).split('\n').filter(Boolean).pop() : '';
                const notePreviewHtml = lastNoteLine
                    ? `<span class="crm-note-preview" title="${window.escHtml(c.notes)}"><i class="fa-regular fa-note-sticky" style="color:var(--primary-red);"></i> ${window.escHtml(lastNoteLine)}</span>`
                    : '';
                
                list.innerHTML += `
                    <tr>
                        <td><span class="crm-badge">${window.escHtml(c.clientId)}</span></td>
                        <td>
                            <strong style="display:block; font-size:12.5px; color:var(--text-light);">${window.escHtml(c.name || 'Unbekannt')}</strong>
                            <span class="crm-cat-tag ${catClass}">${window.escHtml(catStr)}</span>
                            ${notePreviewHtml}
                        </td>
                        <td>${cleanDigits ? `<a href="tel:${window.escHtml(c.phone)}" style="color:inherit; text-decoration:none; font-weight:600;">${window.escHtml(c.phone)}</a>` : '-'}</td>
                        <td>${c.email && c.email.includes('@') ? `<a href="mailto:${window.escHtml(c.email)}" style="color:inherit; text-decoration:none;">${window.escHtml(c.email)}</a>` : '-'}</td>
                        <td style="font-variant-numeric:tabular-nums;">${regDate}</td>
                        <td style="text-align:center;"><span style="display:inline-flex; align-items:center; justify-content:center; min-width:26px; height:24px; padding:0 7px; border-radius:20px; background:var(--bg-input); border:1px solid var(--glass-border); font-weight:900; color:${(c.bookings || 1) > 1 ? 'var(--green-accent)' : 'var(--text-light)'};">${c.bookings || 1}</span></td>
                        <td class="crm-action-cell" style="white-space:nowrap;">
                            ${(() => {
                                const invCount = typeof window.getInvoicesForCustomer === 'function' ? window.getInvoicesForCustomer(c).length : 0;
                                return `<button type="button" class="apt-btn crm-inv-btn mod-invoice ${invCount === 0 ? 'is-zero' : ''}" onclick="window.openInvoicesForCrmClient('${c.clientId}', false)" title="${invCount > 0 ? invCount + ' gespeicherte Belege dieser Person öffnen' : 'Neuen Beleg / Rechnung für diese Person anlegen'}"><i class="fa-solid fa-receipt"></i><span class="crm-inv-count">${invCount}</span></button>`;
                            })()}
                            ${cleanDigits ? `
                                <a href="tel:${window.escHtml(c.phone)}" class="apt-btn call-btn" style="display:inline-flex;" title="Anrufen"><i class="fa-solid fa-phone"></i></a>
                                <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="apt-btn wa-confirm" style="display:inline-flex;" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                            ` : ''}
                            <button type="button" class="apt-btn crm-sync" style="display:inline-flex;" onclick="window.openCRMDetail('${c.clientId}')" title="Kundenakte &amp; Historie bearbeiten"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" class="apt-btn" style="display:inline-flex; color:var(--primary-red); border-color:rgba(217,0,0,0.35);" onclick="window.rebookClient('${c.clientId}')" title="Neuen Termin für diesen Kunden buchen"><i class="fa-solid fa-calendar-plus"></i></button>
                        </td>
                    </tr>
                `;
            });
        };

        window.openCRMViewAll = function() {
            document.getElementById('crmViewAllOverlay').classList.add('open');
            window.renderCRMViewAll();
        };

        window.closeCRMViewAll = function() {
            document.getElementById('crmViewAllOverlay').classList.remove('open');
        };

        window.renderCRMViewAll = function() {
            const list = document.getElementById('crmViewAllList');
            list.innerHTML = '';
            
            let clients = Object.values(window.crmClientsDetail || {});
            clients.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            if(clients.length === 0) {
                list.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px; color:var(--text-muted);">Noch keine Kunden erfasst.</td></tr>';
                return;
            }
            
            clients.forEach(c => {
                let regDate = c.timestamp ? new Date(c.timestamp).toLocaleDateString('de-DE') : '-';
                list.innerHTML += `
                    <tr>
                        <td><span class="crm-badge">${c.clientId}</span></td>
                        <td style="font-weight:700;">${window.escHtml(c.name || '-')}</td>
                        <td>${window.escHtml(c.category || 'Privatkunde')}</td>
                        <td>${window.escHtml(c.phone || '-')}</td>
                        <td>${window.escHtml(c.email || '-')}</td>
                        <td>${window.escHtml(c.birthday || '-')}</td>
                        <td>${window.escHtml(c.address || '-')}</td>
                        <td>${window.escHtml(c.city || '-')}</td>
                        <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis;" title="${window.escHtml(c.notes || '')}">${window.escHtml(c.notes || '-')}</td>
                        <td>${regDate}</td>
                        <td style="text-align:center;">${c.bookings || 1}</td>
                    </tr>
                `;
            });
        };

        window.filterCRM = function() {
            window.renderCRM();
        };

        // --- PAGE BUILDER ---
        window.customPagesData = [];
        window.openPageManager = function() {
            document.getElementById('pageManagerOverlay').classList.add('open');
            window.renderPageManagerList();
        };
       window.updatePageManagerEditBanner = function() {
            const editId = document.getElementById('pmEditingPageId')?.value || '';
            const banner = document.getElementById('pmEditingBanner');
            const lbl = document.getElementById('pmEditingTitleLabel');
            if (editId) {
                if (banner) banner.classList.add('active');
                if (lbl) lbl.innerText = document.getElementById('pmPageTitle')?.value || 'Seite';
            } else {
                if (banner) banner.classList.remove('active');
            }
        };

        window.resetPageManagerForm = function() {
            document.getElementById('pmEditingPageId').value = '';
            document.getElementById('pmPageTitle').value = '';
            if (document.getElementById('pmPageSubtitle')) document.getElementById('pmPageSubtitle').value = '';
            if (document.getElementById('pmPageIcon')) document.getElementById('pmPageIcon').value = 'fa-file-lines';
            if (document.getElementById('pmShowHeader')) document.getElementById('pmShowHeader').checked = true;
            if (document.getElementById('pmShowMenu')) document.getElementById('pmShowMenu').checked = true;
            if (document.getElementById('pmShowFooter')) document.getElementById('pmShowFooter').checked = true;
            if (document.getElementById('pmShowCta')) document.getElementById('pmShowCta').checked = true;
            document.getElementById('pmPageContent').value = '';
            window.updatePageManagerEditBanner();
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
        };

        window.closePageManager = function() {
            document.getElementById('pageManagerOverlay').classList.remove('open');
            window.resetPageManagerForm();
        };

        window.openPageEditorDirect = function(pageId) {
            window.openPageManager();
            setTimeout(() => window.editCustomPage(pageId), 50);
        };

        window.applyPageTemplate = function(tplKey) {
            const templates = {
                about: {
                    title: 'Über RED Berlin',
                    sub: 'Persönlicher Kfz-Zulassungsdienst in der Kienitzer Str. 6, 12053 Berlin',
                    icon: 'fa-building',
                    content: '<h3>Ihr zuverlässiger Partner in Berlin-Neukölln</h3>\n<p>Willkommen beim RED Zulassungsdienst Berlin (Inhaber: Tamer Yazici). Wir übernehmen für Privat- und Gewerbekunden sämtliche Behördengänge beim LABO Berlin – schnell, transparent und ohne Wartezeit.</p>\n<ul>\n<li>Direkt an der U7 Karl-Marx-Straße &amp; U8 Boddinstraße</li>\n<li>Eigene Profi-Schilderpresse vor Ort (Standard &amp; 3D-Carbon)</li>\n<li>Persönliche Beratung Mo–Fr von 09:00 bis 20:00 Uhr</li>\n</ul>'
                },
                b2b: {
                    title: 'Händler & Gewerbe',
                    sub: 'Feste Konditionen & Express-Abwicklung für Autohäuser und Flotten',
                    icon: 'fa-handshake',
                    content: '<h3>Maßgeschneiderter B2B-Zulassungsservice</h3>\n<p>Für Gebrauchtwagenhändler, Werkstätten und Firmenflotten bieten wir feste Abgabezeiten, Sammel-Anmeldungen sowie Kurzzeit- und Zollkennzeichen auf Abruf.</p>\n<ul>\n<li>Direkter Draht ohne Callcenter</li>\n<li>Zuverlässige 24h-Abwicklung nach Absprache</li>\n<li>Vorab-Prüfung der Unterlagen per WhatsApp</li>\n</ul>'
                },
                prices: {
                    title: 'Preisübersicht',
                    sub: 'Transparente Komplettpreise ohne versteckte Kosten',
                    icon: 'fa-euro-sign',
                    content: '<h3>Unsere aktuellen Festpreise</h3>\n<ul>\n<li><strong>Anmeldung mit Wunschkennzeichen:</strong> 100 € (inkl. Gebühren, Schilder &amp; Plakette)</li>\n<li><strong>Anmeldung mit Zufallskennzeichen:</strong> 90 € (inkl. Gebühren, Schilder &amp; Plakette)</li>\n<li><strong>Ummeldung:</strong> 70 €</li>\n<li><strong>Abmeldung:</strong> 30 € vor Ort / 20 € online</li>\n<li><strong>Kurzzeitkennzeichen (6 Tage):</strong> 120 €</li>\n<li><strong>Zollkennzeichen (30 Tage):</strong> 350 €</li>\n</ul>'
                },
                notice: {
                    title: 'Aktuelle Hinweise',
                    sub: 'Öffnungszeiten & wichtige Mitteilungen für unsere Kunden',
                    icon: 'fa-bullhorn',
                    content: '<h3>Aktuelle Kundeninformation</h3>\n<p>Hier finden Sie aktuelle Hinweise zu unseren Öffnungszeiten, Feiertagen und LABO-Bearbeitungszeiten in Berlin.</p>'
                }
            };
            const t = templates[tplKey];
            if (!t) return;
            document.getElementById('pmPageTitle').value = t.title;
            if (document.getElementById('pmPageSubtitle')) document.getElementById('pmPageSubtitle').value = t.sub;
            if (document.getElementById('pmPageIcon')) document.getElementById('pmPageIcon').value = t.icon;
            document.getElementById('pmPageContent').value = t.content;
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            window.showToast(`Vorlage „${t.title}“ geladen – einfach anpassen & speichern!`, 'success');
        };

        window.insertPageFormat = function(kind) {
            const ta = document.getElementById('pmPageContent');
            if (!ta) return;
            const snippets = {
                h3: '\n<h3>Neue Überschrift</h3>\n',
                bold: '<strong>Wichtiger Text</strong>',
                list: '\n<ul>\n  <li>Punkt 1</li>\n  <li>Punkt 2</li>\n</ul>\n',
                box: '\n<div style="background:var(--bg-input); border-left:4px solid var(--primary-red); padding:12px 14px; border-radius:10px; margin:12px 0;"><strong>Hinweis:</strong> Ihr Text hier...</div>\n',
                cta: '\n<button type="button" class="btn-primary" style="margin-top:12px;" onclick="window.desktopNavGo(\'termin\')"><i class="fa-regular fa-calendar-check"></i> Jetzt Wunschtermin sichern</button>\n'
            };
            const ins = snippets[kind] || '';
            const start = ta.selectionStart || ta.value.length;
            ta.value = ta.value.slice(0, start) + ins + ta.value.slice(ta.selectionEnd || start);
            ta.focus();
        };

        window.formatCustomPageBodyHtml = function(raw) {
            const txt = String(raw || '').trim();
            if (!txt) return '';
            // Wenn bereits HTML-Blöcke enthalten sind, sauber ohne übermäßige Leerzeilen rendern
            if (/<(h[1-6]|p|ul|ol|div|section|table)\b/i.test(txt)) {
                return txt;
            }
            return txt.split(/\n{2,}/).map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('');
        };

        window.saveCustomPage = async function() {
            const title = document.getElementById('pmPageTitle').value.trim();
            const subtitle = (document.getElementById('pmPageSubtitle')?.value || '').trim();
            const icon = document.getElementById('pmPageIcon')?.value || 'fa-file-lines';
            const showHeader = document.getElementById('pmShowHeader')?.checked !== false;
            const showMenu = document.getElementById('pmShowMenu')?.checked !== false;
            const showFooter = document.getElementById('pmShowFooter')?.checked !== false;
            const showCta = document.getElementById('pmShowCta')?.checked !== false;
            const content = document.getElementById('pmPageContent').value;
            const editId = document.getElementById('pmEditingPageId').value;

            if (!title) { window.showToast('Bitte einen Seitentitel eingeben.', 'error'); return; }

            const existing = editId ? window.customPagesData.find(p => p.id === editId) : null;
            const maxOrder = window.customPagesData.reduce((m, p, idx) => Math.max(m, Number.isFinite(p.order) ? p.order : idx), -1);
            const pageData = {
                title, subtitle, icon, showHeader, showMenu, showFooter, showCta, content,
                order: existing && Number.isFinite(existing.order) ? existing.order : (maxOrder + 1),
                timestamp: existing?.timestamp || Date.now(),
                updatedAt: Date.now()
            };

            try {
                if (editId) {
                    await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "custom_pages", editId), pageData, { merge: true });
                    const idx = window.customPagesData.findIndex(p => p.id === editId);
                    if (idx > -1) window.customPagesData[idx] = { id: editId, ...pageData };
                    window.showToast(`Seite „${title}“ aktualisiert!`, 'success');
                } else {
                    const docRef = await window.firebaseAddDoc(window.firebaseCollection(window.firebaseDb, "custom_pages"), pageData);
                    if (!window.customPagesData.some(p => p.id === docRef.id)) {
                        window.customPagesData.push({ id: docRef.id, ...pageData });
                    }
                    window.showToast(`Seite „${title}“ veröffentlicht!`, 'success');
                }
            } catch (e) {
                if (editId) {
                    const idx = window.customPagesData.findIndex(p => p.id === editId);
                    if (idx > -1) window.customPagesData[idx] = { id: editId, ...pageData };
                } else {
                    window.customPagesData.push({ id: 'page-' + Date.now(), ...pageData });
                }
                window.showToast('Seite lokal gespeichert.', 'success');
            }

            localStorage.setItem('red_custom_pages', JSON.stringify(window.customPagesData));
            window.renderCustomPagesToDOM();
            window.resetPageManagerForm();
            window.renderPageManagerList();
        };

        window.editCustomPage = function(id) {
            const page = window.customPagesData.find(p => p.id === id);
            if (!page) return;
            document.getElementById('pmEditingPageId').value = page.id;
            document.getElementById('pmPageTitle').value = page.title || '';
            if (document.getElementById('pmPageSubtitle')) document.getElementById('pmPageSubtitle').value = page.subtitle || '';
            if (document.getElementById('pmPageIcon')) document.getElementById('pmPageIcon').value = page.icon || 'fa-file-lines';
            if (document.getElementById('pmShowHeader')) document.getElementById('pmShowHeader').checked = page.showHeader !== false;
            if (document.getElementById('pmShowMenu')) document.getElementById('pmShowMenu').checked = page.showMenu !== false;
            if (document.getElementById('pmShowFooter')) document.getElementById('pmShowFooter').checked = page.showFooter !== false;
            if (document.getElementById('pmShowCta')) document.getElementById('pmShowCta').checked = page.showCta !== false;
            document.getElementById('pmPageContent').value = page.content || '';
            window.updatePageManagerEditBanner();
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            document.querySelector('#pageManagerOverlay .exec-studio-body')?.scrollTo({ top: 0, behavior: 'smooth' });
        };

        window.moveCustomPageOrder = async function(id, delta) {
            const list = window.customPagesData || [];
            const idx = list.findIndex(p => p.id === id);
            const targetIdx = idx + delta;
            if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) return;

            const [moved] = list.splice(idx, 1);
            list.splice(targetIdx, 0, moved);
            list.forEach((p, i) => { p.order = i; });

            localStorage.setItem('red_custom_pages', JSON.stringify(list));
            window.renderCustomPagesToDOM();
            window.renderPageManagerList();

            if (window.firebaseDb && window.firebaseSetDoc) {
                for (const p of list) {
                    window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "custom_pages", p.id), { order: p.order }, { merge: true }).catch(() => {});
                }
            }
            window.showToast('Seiten-Reihenfolge aktualisiert!', 'success');
        };

        window.deleteCustomPage = function(id) {
            const target = (window.customPagesData || []).find(p => p.id === id);
            window.openRedDeleteConfirm(
                `Seite „${target?.title || 'Seite'}“ löschen?`,
                'Möchten Sie diese benutzerdefinierte Seite wirklich dauerhaft aus Menü, Header und Footer entfernen?',
                async () => {
                    const wasViewing = window.getCurrentViewId() === ('view-' + id);
                    window.customPagesData = (window.customPagesData || []).filter(p => p.id !== id);
                    localStorage.setItem('red_custom_pages', JSON.stringify(window.customPagesData));

                    if (document.getElementById('pmEditingPageId')?.value === id) {
                        window.resetPageManagerForm();
                    }
                    if (wasViewing) {
                        window.switchView('view-home');
                    }

                    window.renderCustomPagesToDOM();
                    window.renderPageManagerList();

                    try {
                        await window.firebaseDeleteDoc(window.firebaseDoc(window.firebaseDb, "custom_pages", id));
                        window.showToast('Seite dauerhaft gelöscht!', 'success');
                    } catch (e) {
                        window.showToast('Seite entfernt.', 'success');
                    }
                }
            );
        };

        window.renderPageManagerList = function() {
            const list = document.getElementById('pmPagesList');
            const badge = document.getElementById('pmPageCountBadge');
            const pages = window.customPagesData || [];
            if (badge) badge.innerText = `${pages.length} ${pages.length === 1 ? 'Seite' : 'Seiten'}`;
            if (!list) return;
            list.innerHTML = '';
            if (pages.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px; background:var(--bg-card); border-radius:10px;">Noch keine eigenen Unterseiten erstellt – oben eine Vorlage wählen oder frei schreiben.</div>';
                return;
            }
            pages.forEach((p, idx) => {
                const loc = [
                    p.showHeader !== false ? 'Desktop-Header' : '',
                    p.showMenu !== false ? 'Menü' : '',
                    p.showFooter !== false ? 'Footer' : ''
                ].filter(Boolean).join(' • ') || 'Nur Direktlink';

                list.innerHTML += `
                    <div class="pm-page-card">
                        <div class="pm-page-info">
                            <strong><i class="fa-solid ${window.escHtml(p.icon || 'fa-file-lines')}" style="color:var(--primary-red); margin-right:6px;"></i>${window.escHtml(p.title)}</strong>
                            <span>${loc}</span>
                        </div>
                        <div class="pm-page-actions">
                            ${idx > 0 ? `<button type="button" class="apt-btn" onclick="window.moveCustomPageOrder('${p.id}', -1)" title="Nach oben"><i class="fa-solid fa-arrow-up"></i></button>` : ''}
                            ${idx < pages.length - 1 ? `<button type="button" class="apt-btn" onclick="window.moveCustomPageOrder('${p.id}', 1)" title="Nach unten"><i class="fa-solid fa-arrow-down"></i></button>` : ''}
                            <button type="button" class="apt-btn" onclick="window.closePageManager(); window.switchView('view-${p.id}');" title="Seite öffnen"><i class="fa-solid fa-eye"></i></button>
                            <button type="button" class="apt-btn edit" onclick="window.editCustomPage('${p.id}')" title="Bearbeiten"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" class="apt-btn delete" onclick="window.deleteCustomPage('${p.id}')" title="Dauerhaft löschen"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
        };

        window.renderCustomPagesToDOM = function() {
            const activeBefore = window.getCurrentViewId();

            document.querySelectorAll('.dynamic-custom-page').forEach(e => e.remove());
            document.querySelectorAll('.dynamic-menu-item').forEach(e => e.remove());
            document.querySelectorAll('.dynamic-footer-item').forEach(e => e.remove());
            document.querySelectorAll('.dynamic-desktop-nav-item').forEach(e => e.remove());

            const pagesHost = document.getElementById('customPagesContainer') || document.body;
            const desktopNavHost = document.getElementById('dynamicDesktopNavContainer');
            const menuContainer = document.getElementById('dynamicMenuItemsContainer');
            const footerLinks = document.getElementById('dynamicFooterLinks');

            if (menuContainer) menuContainer.innerHTML = '';
            if (desktopNavHost) desktopNavHost.innerHTML = '';

            const sortedPages = [...(window.customPagesData || [])].sort((a, b) => (a.order ?? a.timestamp ?? 0) - (b.order ?? b.timestamp ?? 0));

            sortedPages.forEach(page => {
                const viewId = 'view-' + page.id;
                const view = document.createElement('div');
                view.id = viewId;
                view.className = 'view-section dynamic-custom-page' + (activeBefore === viewId ? ' active' : '');
                const bodyHtml = window.formatCustomPageBodyHtml(page.content);
                const ctaHtml = page.showCta !== false ? `
                    <div class="custom-page-cta-bar">
                        <div>
                            <strong style="display:block; font-size:13px; color:var(--text-light);">Fragen oder direkt loslegen?</strong>
                            <span style="font-size:11px; color:var(--text-muted);">Kienitzer&nbsp;Str.&nbsp;6, 12053&nbsp;Berlin • Mo–Fr 09:00–20:00&nbsp;Uhr</span>
                        </div>
                        <div class="custom-page-cta-actions">
                            <button type="button" class="btn-primary" onclick="window.desktopNavGo('termin')"><i class="fa-regular fa-calendar-check"></i> Termin buchen</button>
                            <button type="button" class="btn-primary" style="background:#25D366; color:#000; box-shadow:none;" onclick="window.startPhotoPreCheckWhatsApp(false)"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>
                        </div>
                    </div>
                ` : '';

                view.innerHTML = `
                    <div class="subpage-nav-bar">
                        <button type="button" class="subpage-back-btn" onclick="window.switchView('view-home')"><i class="fa-solid fa-arrow-left"></i> Zurück zur Startseite</button>
                        <div class="subpage-actions-group subpage-admin-group mod-pages">
                            <button type="button" class="subpage-action-btn is-edit" onclick="window.openPageEditorDirect('${page.id}')"><i class="fa-solid fa-pen"></i> Seite bearbeiten</button>
                            <button type="button" class="subpage-action-btn is-del" onclick="window.deleteCustomPage('${page.id}')"><i class="fa-solid fa-trash"></i> Seite löschen</button>
                        </div>
                    </div>
                    <article class="custom-page-shell">
                        <header class="custom-page-hero">
                            <span class="custom-page-eyebrow"><i class="fa-solid fa-shield-halved"></i> RED Zulassungsdienst Berlin</span>
                            <h1><i class="fa-solid ${window.escHtml(page.icon || 'fa-file-lines')}"></i><span>${window.escHtml(page.title)}</span></h1>
                            ${page.subtitle ? `<p>${window.escHtml(page.subtitle)}</p>` : ''}
                        </header>
                        <div class="custom-page-body">${bodyHtml}</div>
                        ${ctaHtml}
                    </article>
                `;
                pagesHost.appendChild(view);

                if (desktopNavHost && page.showHeader !== false) {
                    const aDesk = document.createElement('a');
                    aDesk.className = 'dhn-link dynamic-desktop-nav-item';
                    aDesk.href = 'javascript:void(0)';
                    aDesk.setAttribute('data-nav-key', viewId);
                    aDesk.onclick = () => window.switchView(viewId);
                    aDesk.innerText = page.title;
                    desktopNavHost.appendChild(aDesk);
                }

                if (menuContainer && page.showMenu !== false) {
                    const aMenu = document.createElement('a');
                    aMenu.className = 'dynamic-menu-item';
                    aMenu.href = 'javascript:void(0)';
                    aMenu.onclick = () => { window.toggleMenu(); window.switchView(viewId); };
                    aMenu.innerHTML = `<i class="fa-solid ${window.escHtml(page.icon || 'fa-file-lines')}" style="color:var(--primary-red);"></i> ${window.escHtml(page.title)}`;
                    menuContainer.appendChild(aMenu);
                }

                if (footerLinks && page.showFooter !== false) {
                    const aFooter = document.createElement('a');
                    aFooter.className = 'dynamic-footer-item';
                    aFooter.href = 'javascript:void(0)';
                    aFooter.onclick = () => window.switchView(viewId);
                    aFooter.innerText = page.title;
                    footerLinks.insertBefore(aFooter, footerLinks.children[3]);
                }
            });

            // Falls die vorher offene Seite gelöscht wurde, sauber zur Startseite wechseln
            if (activeBefore && activeBefore.startsWith('view-') && !document.getElementById(activeBefore)) {
                window.switchView('view-home', false);
            } else if (typeof window.updateHeaderNavActiveState === 'function') {
                window.updateHeaderNavActiveState(window.getCurrentViewId());
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            const savedContact = JSON.parse(localStorage.getItem('red_contact'));
            if(savedContact) window.applyContactInfo(savedContact);

            const savedContent = JSON.parse(localStorage.getItem('red_page_content'));
            if(savedContent) window.applyPageContent(savedContent);
            else window.applyPageContent(window.pageContentData);

            window.renderServices(window.servicesData);

            window.showCookieBannerIfNeeded(450);

            if (typeof window.initStepByStepBackNavigation === 'function') {
                window.initStepByStepBackNavigation();
            }

            window.acceptAllCookies = function() {
                if(document.getElementById('cookieExternalMedia')) document.getElementById('cookieExternalMedia').checked = true;
                if(document.getElementById('cookieAnalytics')) document.getElementById('cookieAnalytics').checked = true;
                try {
                    localStorage.setItem('cookie_consent', 'all');
                    sessionStorage.setItem('cookie_consent', 'all');
                } catch(e) {}
                window.enableGoogleMaps();
                document.getElementById('cookieConsentOverlay').classList.remove('show');
                window.showToast('Alle Einstellungen gespeichert.', 'success');
            };

            window.acceptSelectedCookies = function() {
                try {
                    localStorage.setItem('cookie_consent', 'selected');
                    sessionStorage.setItem('cookie_consent', 'selected');
                } catch(e) {}
                if(document.getElementById('cookieExternalMedia')?.checked) {
                    window.enableGoogleMaps();
                }
                document.getElementById('cookieConsentOverlay').classList.remove('show');
                window.showToast('Ihre Auswahl wurde gespeichert.', 'success');
            };

            window.openLegal = function(type) {
                const title = document.getElementById('legalTitle');
                const content = document.getElementById('legalContentText');
                const extraDsgvo = window.pageContentData?.legal?.datenschutz_extra || '';
                
                if(type === 'impressum') {
                    title.innerText = 'Impressum';
                    const rawUstid = (window.dynamicContactData.ustid || '').trim();
                    const hasValidUstid = rawUstid !== '' && !rawUstid.toLowerCase().includes('hier steuernummer');
                    const ustidBlock = hasValidUstid
                        ? `<br><br><strong>Umsatzsteuer-ID:</strong><br>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br>${window.escHtml(rawUstid)}`
                        : '';
                    content.innerHTML = `<strong>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz):</strong><br><br>RED Zulassungsdienst Berlin<br>Inhaber: Tamer Yazici<br>Kienitzer Str. 6<br>12053 Berlin<br><br><strong>Kontakt:</strong><br>Telefon: ${window.escHtml(window.dynamicContactData.phone)}<br>E-Mail: ${window.escHtml(window.dynamicContactData.email)}${ustidBlock}<br><br><strong>Verbraucherstreitbeilegung / Universalschlichtungsstelle (§ 36 VSBG):</strong><br>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.<br><br><strong>Haftung für Inhalte & Links:</strong><br>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.`;
                } else {
                    title.innerText = 'Datenschutzerklärung (DSGVO / TDDDG)';
                    content.innerHTML = `<strong>1. Datenschutz auf einen Blick</strong><br>Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst und behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften (DSGVO, BDSG sowie TDDDG).<br><br><strong>2. Verantwortliche Stelle</strong><br>RED Zulassungsdienst Berlin, Inhaber: Tamer Yazici, Kienitzer Str. 6, 12053 Berlin, E-Mail: ${window.dynamicContactData.email}, Telefon: ${window.dynamicContactData.phone}.<br><br><strong>3. Lokale Schriftarten (Kein externes Font-Tracking)</strong><br>Zum Schutz Ihrer Privatsphäre nutzt diese Seite lokal optimierte Systemschriftarten. Es erfolgt beim Seitenaufruf keine unbefugte Übertragung Ihrer IP-Adresse an externe Schriftarten-Server.<br><br><strong>4. Terminbuchung & Auftragsabwicklung (Art. 6 Abs. 1 lit. b DSGVO)</strong><br>${extraDsgvo}<br><br><strong>5. Externe Medien (2-Klick-Schutz für Standortkarte)</strong><br>Externe Karteninhalte werden erst nach Ihrer ausdrücklichen Aktivierung geladen (Art. 6 Abs. 1 lit. a DSGVO).<br><br><strong>6. Ihre Rechte (Auskunft, Berichtigung, Löschung, Widerruf)</strong><br>Sie haben jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten sowie ein Recht auf Berichtigung, Einschränkung der Verarbeitung oder Löschung dieser Daten (Art. 15–21 DSGVO).`;
                }
                document.getElementById('legalOverlay').classList.add('open');
            };

            window.closeLegal = function() { document.getElementById('legalOverlay').classList.remove('open'); };

            window.openWidgetModal = function(type) {
                const title = document.getElementById('widgetModalTitle');
                const content = document.getElementById('widgetModalContent');
                
                if(type === 'calendar') {
                    title.innerHTML = '<i class="fa-solid fa-calendar-days" style="color:var(--primary-red);"></i> Berliner Monats- & Terminkalender';
                    window.calModalYear = new Date().getFullYear();
                    window.calModalMonth = new Date().getMonth();
                    window.renderHeaderInteractiveCalendar();
                } else if(type === 'office') {
                    title.innerHTML = '<i class="fa-solid fa-door-open" style="color:var(--primary-red);"></i> Büro- & Annahme-Status';
                    const bn = window.getBerlinNowParts();
                    const todayHoliday = window.isBerlinHolidayYMD(bn.year, bn.month, bn.day);
                    const isWorkday = (bn.dayNum >= 1 && bn.dayNum <= 5) && !todayHoliday;
                    const isOpen = isWorkday && (bn.h >= 9 && bn.h < 20);
                    const statusHeadline = isOpen ? 'JETZT GEÖFFNET' : (todayHoliday ? `FEIERTAG (${todayHoliday})` : 'AKTUELL GESCHLOSSEN');
                    content.innerHTML = `
                        <div style="font-size: clamp(16px, 4.4vw, 19px); font-weight: 900; color: ${isOpen ? 'var(--green-accent)' : '#d97706'}; margin-bottom: 14px; line-height: 1.3;">
                            <i class="fa-solid ${isOpen ? 'fa-circle-check' : 'fa-moon'}" style="margin-right:6px;"></i>${statusHeadline}
                            <span class="paren-sub" style="color:var(--text-muted); font-size:12px;">${isOpen ? '(Sofort-Annahme vor Ort)' : '(Online-Termin 24/7 aktiv)'}</span>
                        </div>
                        <div style="background:var(--bg-input); border:1px solid var(--glass-border); border-radius:12px; padding:14px; text-align:left; font-size:12px; color:var(--text-light); margin-bottom:15px;">
                            <strong>Unsere Servicezeiten vor Ort:</strong><br>
                            • Montag – Freitag: <strong>09:00 – 20:00 Uhr</strong><br>
                            • Standort: <strong>Kienitzer Str. 6, 12053 Berlin</strong><br>
                            • Sofortkennzeichen & Dokumenten-Annahme ohne Wartezeit!
                        </div>
                        <button class="btn-primary" style="width:100%; justify-content:center;" onclick="window.closeWidgetModal(); window.switchView('view-home'); document.getElementById('termin').scrollIntoView({behavior:'smooth'});"><i class="fa-regular fa-calendar-check"></i> Jetzt Wunschtermin reservieren</button>
                    `;
                } else if(type === 'time') {
                    title.innerHTML = '<i class="fa-regular fa-clock"></i> Datum & Uhrzeit';
                    const renderTimeModal = () => {
                        const now = new Date();
                        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                        content.innerHTML = `
                            <div style="font-size: 40px; font-weight: 900; color: var(--primary-red); margin-bottom: 10px;">${timeStr}</div>
                            <div style="font-size: 16px; font-weight: 600; color: var(--text-light);">${dateStr}</div>
                            <div style="font-size: 12px; color: var(--text-muted); margin-top: 15px;">Zeitzone: Mitteleuropäische Zeit (Berlin) • KW ${window.getISOWeekNumber(now)}</div>
                        `;
                    };
                    renderTimeModal();
                    window.modalClockInterval = setInterval(renderTimeModal, 1000); 
                } else if (type === 'weather') {
                    title.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> Live Wetter Berlin';
                    if(window.currentWeatherData) {
                        const temp = Math.round(window.currentWeatherData.temperature);
                        const wind = window.currentWeatherData.windspeed;
                        let icon = '<i class="fa-solid fa-cloud-sun" style="font-size:50px; color:#888;"></i>';
                        if(temp > 22) icon = '<i class="fa-solid fa-sun" style="font-size:50px; color:#ff9500;"></i>';
                        if(temp < 5) icon = '<i class="fa-solid fa-snowflake" style="font-size:50px; color:#00a8cc;"></i>';
                        
                        content.innerHTML = `
                            <div style="margin-bottom: 15px;">${icon}</div>
                            <div style="font-size: 35px; font-weight: 900; color: var(--text-light);">${temp} °C</div>
                            <div style="font-size: 14px; font-weight: 600; color: var(--text-muted); margin-top: 10px;">Windgeschwindigkeit: ${wind} km/h</div>
                        `;
                    } else {
                        content.innerHTML = '<p>Aktuelle Wetterdaten für Berlin sind geladen.</p>';
                    }
                } else if (type === 'visitors') {
                    title.innerHTML = '<i class="fa-solid fa-chart-line"></i> System-Status';
                    const v = document.getElementById('vCount').innerText;
                    
                    let adminBtnHtml = '';
                    if(window.isAuthorized) {
                        adminBtnHtml = `
                            <div style="border-top: 1px solid var(--glass-border); padding-top: 15px; margin-top: 20px;">
                                <label style="font-size: 10px; color: var(--primary-red); text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 8px;">Zählerstand korrigieren</label>
                                <div style="display: flex; gap: 10px;">
                                    <input type="number" id="adminNewCountInput" class="form-control" style="flex: 1; text-align: center; font-weight: bold;" placeholder="Zahl (z.B. 744)">
                                    <button class="btn-primary" style="background:#ff9500; color:#000; padding: 0 20px;" onclick="window.setCustomVisitorCount()"><i class="fa-solid fa-check"></i></button>
                                </div>
                            </div>
                        `;
                    }

                    content.innerHTML = `
                        <div style="width:54px; height:54px; margin:0 auto 12px; border-radius:14px; background:var(--green-bg-soft); border:1.5px solid var(--green-border); display:flex; align-items:center; justify-content:center; color:var(--green-accent); font-size:22px;">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <div style="font-size: 32px; font-weight: 900; color: var(--text-light); margin-bottom: 4px;">${v}</div>
                        <div style="font-size: 12.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px;">Verifizierte Seitenaufrufe</div>
                        <div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; color:var(--green-accent); background:var(--green-bg-soft); padding:4px 12px; border-radius:20px;">
                            <span style="width:7px; height:7px; border-radius:50%; background:var(--green-accent);"></span> System & Online-Terminbuchung aktiv
                        </div>
                        ${adminBtnHtml}
                    `;
                }
                document.getElementById('widgetModalOverlay').classList.add('open');
            };

            window.closeWidgetModal = function() {
                if(window.modalClockInterval) clearInterval(window.modalClockInterval);
                window.updateHeaderCalendarChip();
                document.getElementById('widgetModalOverlay').classList.remove('open');
            };

            window.setCustomVisitorCount = async function() {
                const inputEl = document.getElementById('adminNewCountInput');
                let rawVal = inputEl && inputEl.value.trim() !== "" ? inputEl.value.trim() : prompt("Bitte den neuen Zählerstand eingeben (z.B. 744):");
                if(rawVal === null || rawVal.trim() === "") return;

                const parsedCount = parseInt(rawVal.trim(), 10);
                if(!isNaN(parsedCount) && parsedCount >= 0) {
                    if(window.firebaseDb && window.firebaseSetDoc) {
                        try {
                            await window.firebaseSetDoc(
                                window.firebaseDoc(window.firebaseDb, "settings", "visitors"), 
                                { count: parsedCount }, 
                                { merge: true }
                            );
                            sessionStorage.setItem('red_visited_counted', 'true');
                            window.showToast("Zählerstand erfolgreich auf " + parsedCount + " aktualisiert!", "success");
                            window.closeWidgetModal();
                            document.querySelectorAll('#vCount').forEach(el => el.innerText = parsedCount.toLocaleString('de-DE'));
                        } catch(e) {
                            console.error("Firebase Zähler-Fehler:", e);
                            window.showToast("Fehler beim Speichern: " + (e.message || "Keine Berechtigung"), "error");
                        }
                    } else {
                        document.querySelectorAll('#vCount').forEach(el => el.innerText = parsedCount.toLocaleString('de-DE'));
                        window.closeWidgetModal();
                    }
                } else {
                    window.showToast("Bitte nur gültige Zahlen eingeben.", "error");
                }
            };
            
            document.querySelectorAll('.custom-dialog-overlay, .info-popup-overlay').forEach(overlay => {
                overlay.addEventListener('click', function(e) {
                    if(e.target === this) {
                        this.classList.remove('open', 'active');
                        if(this.id === 'deleteConfirmOverlay') { window.deleteTargetId = null; window.deleteNoteTargetId = null; }
                        if(this.id === 'passChangeOverlay') document.getElementById('newPassInput').value = '';
                        if(this.id === 'widgetModalOverlay') window.closeWidgetModal();
                        if(this.id === 'serviceConfigOverlay') window.editingServiceId = null;
                        if(this.id === 'pageManagerOverlay') window.closePageManager();
                        if(this.id === 'themeEditorOverlay') window.closeThemeEditor();
                        if(this.id === 'crmViewAllOverlay') window.closeCRMViewAll();
                        if(this.id === 'calcItemEditOverlay') window.closeCalcEditModal();
                        if(this.id === 'formEditModalOverlay') window.closeFormEditModal();
                        if(this.id === 'digitalVollmachtOverlay') window.closeDigitalVollmachtModal();
                        if(this.id === 'kaufvertragOverlay') window.closeKaufvertragModal();
                        if(this.id === 'cashInvoiceOverlay') window.closeCashInvoiceModal();
                        if(this.id === 'shopPhotoEditOverlay') window.closeShopPhotoModal();
                        if(this.id === 'redVideoCenterOverlay') window.closeVideoCenterModal();
                        if(this.id === 'videoManagerOverlay') window.closeVideoManagerModal();
                        if(this.id === 'viralShareOverlay') window.closeViralShareModal();
                        if(this.id === 'pwaInstallOverlay') window.closePwaInstallModal();
                        if(this.id === 'callbackRequestOverlay') window.closeCallbackModal();
                    }
                });
            });

            window.chosenHour = null;
            window.editModalChosenHour = null;

            try {
                flatpickr("#datePicker", {
                    locale: "de",
                    dateFormat: "d.m.Y",
                    minDate: "today", 
                    disableMobile: "true", 
                    disable: [ function(d) { return d.getDay() === 0 || d.getDay() === 6 || !!window.getBerlinHolidayName(d); } ],
                    onChange: function(selectedDates, dateStr, instance) {
                        document.getElementById('timeWrapper').style.display = 'block';
                        const container = document.getElementById('timeSlots');
                        container.innerHTML = '';
                        window.chosenHour = null;
                        document.getElementById('submitBtn').disabled = true;
                        window.updateBookingLiveSummary();
                        
                        const normTarget = window.normalizeDateDE(dateStr);
                        const bn = window.getBerlinNowParts();
                        const todayDE = `${String(bn.day).padStart(2, '0')}.${String(bn.month).padStart(2, '0')}.${bn.year}`;
                        const isSelectedToday = (normTarget === todayDE);
                        const minSelectableMins = (bn.h * 60) + bn.m + 30;

                        const bookedTimes = (window.bookedSlotsList || [])
                            .filter(s => window.normalizeDateDE(s.date) === normTarget)
                            .map(s => (s.time || '').replace(' Uhr','').trim());

                        let freeSlotsCount = 0;

                        for(let h = 9; h <= 19; h++) {
                            for(let m of ['00', '30']) {
                                const tStr = `${h.toString().padStart(2, '0')}:${m}`;
                                const slotMins = (h * 60) + parseInt(m, 10);
                                const isPastSlot = isSelectedToday && (slotMins < minSelectableMins);

                                const div = document.createElement('div');
                                div.className = 'time-slot'; div.innerText = tStr + " Uhr";
                                
                                if(bookedTimes.includes(tStr) || isPastSlot) {
                                    div.classList.add('booked');
                                    div.title = isPastSlot ? "Zeitfenster bereits vergangen" : "Bereits vergeben";
                                } else {
                                    freeSlotsCount++;
                                    div.addEventListener('click', () => {
                                        Array.from(container.children).forEach(c => c.classList.remove('active'));
                                        div.classList.add('active');
                                        window.chosenHour = tStr;
                                        document.getElementById('submitBtn').disabled = false;
                                        window.updateBookingLiveSummary();
                                    });
                                }
                                container.appendChild(div);
                            }
                        }

                        if (freeSlotsCount === 0) {
                            const hint = document.createElement('div');
                            hint.style.cssText = 'grid-column:1/-1; text-align:center; font-size:11.5px; font-weight:700; color:var(--primary-red); padding:8px; background:var(--bg-input); border-radius:10px;';
                            hint.innerText = 'Für heute sind keine Zeitfenster mehr frei – bitte wählen Sie den nächsten Werktag.';
                            container.appendChild(hint);
                        }
                    }
                });

                flatpickr("#editAptDate", {
                    locale: "de",
                    dateFormat: "d.m.Y",
                    minDate: "today", 
                    disableMobile: "true",
                    disable: [ function(d) { return d.getDay() === 0 || d.getDay() === 6 || !!window.getBerlinHolidayName(d); } ],
                    onChange: function(selectedDates, dateStr, instance) {
                        const selectTime = document.getElementById('editAptTime');
                        selectTime.innerHTML = '<option value="Ganztägig">Ganztägig</option>';
                        
                        const normTarget = window.normalizeDateDE(dateStr);
                        const bookedTimes = (window.redApts || [])
                            .filter(a => window.normalizeDateDE(a.date) === normTarget && a.id !== window.editingAptId && Number(a.orderStatus) !== 4)
                            .map(a => (a.timeLabel || '').replace(' Uhr','').trim());

                        for(let h = 9; h <= 19; h++) {
                            for(let m of ['00', '30']) {
                                const tStr = `${h.toString().padStart(2, '0')}:${m}`;
                                const opt = document.createElement('option');
                                opt.value = tStr + ' Uhr';
                                opt.innerText = tStr + ' Uhr';
                                if(bookedTimes.includes(tStr)) {
                                    opt.disabled = true;
                                    opt.innerText += ' (Belegt)';
                                }
                                selectTime.appendChild(opt);
                            }
                        }
                    }
                });

            } catch (err) {
                const dp = document.getElementById('datePicker');
                dp.type = 'date';
                dp.addEventListener('change', () => {
                    document.getElementById('submitBtn').disabled = false;
                    window.chosenHour = "Ganztägig";
                    window.updateBookingLiveSummary();
                });
            }

            const trigger = document.getElementById('serviceSelectBox');
            window.selectedServiceVal = "Anmeldung";
            trigger.addEventListener('click', (e) => { e.stopPropagation(); trigger.classList.toggle('open'); });
            
            document.addEventListener('click', () => trigger.classList.remove('open'));
        });

        window.showToast = function(msg, type='success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast-msg toast-${type}`;
            toast.innerHTML = (type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>') + ` <span>${msg}</span>`;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        };

        window.triggerLogoBubble = function(e) {
            e.preventDefault();
            const headerEl = document.getElementById('header-wrapper');
            if (headerEl) headerEl.classList.remove('header-compact');
            if (window.getCurrentViewId() === 'view-home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.switchView('view-home');
            }
        };

        window._openModalOrder = [];
        window._lastHistoryState = null;
        window._lastBackExitHint = 0;

        window.getCurrentViewId = function() {
            const active = document.querySelector('.view-section.active');
            return active ? active.id : 'view-home';
        };

        window.pushAppHistoryState = function(stateObj, replaceOnly = false) {
            const hashStr = '#' + (stateObj.view || 'view-home');
            if (replaceOnly) {
                history.replaceState(stateObj, '', hashStr);
            } else {
                history.pushState(stateObj, '', hashStr);
            }
            window._lastHistoryState = stateObj;
        };

        window.closeTopmostUiLayer = function() {
            // 1. Mobiles Select-Sheet
            const mobileSel = document.getElementById('mobileSelectOverlay');
            if (mobileSel && mobileSel.classList.contains('open')) {
                window.closeMobileSelectSheet();
                return true;
            }
            // 2. Geöffneter Flatpickr-Kalender
            const openFp = document.querySelector('.flatpickr-calendar.open');
            if (openFp) {
                ['datePicker', 'editAptDate'].forEach(id => {
                    const fp = document.getElementById(id)?._flatpickr;
                    if (fp && fp.isOpen) fp.close();
                });
                return true;
            }
            // 3. Vollbild-Menü
            const qMenu = document.getElementById('quickMenu');
            if (qMenu && qMenu.classList.contains('active')) {
                window.toggleMenu();
                return true;
            }
            // 4. Aufgeklappte Schnell-Service-Leiste
            const qBar = document.getElementById('floatingQuickBar');
            if (qBar && qBar.classList.contains('fab-open')) {
                window.closeMobileQuickBar();
                return true;
            }
            // 5. Oberstes offenes Modal / Dialogfenster
            const openOverlays = Array.from(document.querySelectorAll('.custom-dialog-overlay.open'));
            if (openOverlays.length > 0) {
                let targetOv = null;
                for (let i = window._openModalOrder.length - 1; i >= 0; i--) {
                    const candidate = document.getElementById(window._openModalOrder[i]);
                    if (candidate && candidate.classList.contains('open')) {
                        targetOv = candidate;
                        break;
                    }
                }
                if (!targetOv) targetOv = openOverlays[openOverlays.length - 1];
                targetOv.classList.remove('open');
                if (targetOv.id === 'cashInvoiceOverlay') document.body.classList.remove('invoice-modal-open');
                if (targetOv.id === 'redVideoCenterOverlay') window.closeVideoCenterModal();
                if (targetOv.id === 'widgetModalOverlay') window.closeWidgetModal();
                if (targetOv.id === 'deleteConfirmOverlay') { window.deleteTargetId = null; window.deleteNoteTargetId = null; }
                return true;
            }
            return false;
        };

        window.initStepByStepBackNavigation = function() {
            if (window._stepBackInitDone) return;
            window._stepBackInitDone = true;

            const hash = window.location.hash.substring(1);
            const hasStartSubView = hash && hash !== 'view-home' && document.getElementById(hash) && document.getElementById(hash).classList.contains('view-section');

            // Root-Basis auf Startseite setzen
            window.pushAppHistoryState({ view: 'view-home', redRoot: true }, true);

            if (hasStartSubView) {
                window.pushAppHistoryState({ view: hash }, false);
                window.switchView(hash, false);
            } else {
                // Beim ersten Fingertipp / Klick sanften Schutz-Schritt aktivieren
                const armRootGuard = () => {
                    if (history.state && history.state.redRoot) {
                        window.pushAppHistoryState({ view: 'view-home', redGuard: true }, false);
                    }
                };
                document.addEventListener('pointerdown', armRootGuard, { once: true, passive: true });
            }

            // Jedes Öffnen von Modals, Menü, Select-Sheet oder Service-Leiste als Schritt merken
            const layerSpecs = [
                ...Array.from(document.querySelectorAll('.custom-dialog-overlay')).map(el => ({ el, cls: 'open' })),
                { el: document.getElementById('quickMenu'), cls: 'active' },
                { el: document.getElementById('mobileSelectOverlay'), cls: 'open' },
                { el: document.getElementById('floatingQuickBar'), cls: 'fab-open' }
            ];

            const layerObs = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    const el = m.target;
                    const cls = el.dataset.backCls;
                    if (!cls) return;
                    const isOpenNow = el.classList.contains(cls);
                    const wasOpen = (m.oldValue || '').split(/\s+/).includes(cls);

                    if (isOpenNow && !wasOpen) {
                        window._openModalOrder = window._openModalOrder.filter(id => id !== el.id);
                        window._openModalOrder.push(el.id);
                        window.pushAppHistoryState({ view: window.getCurrentViewId(), redLayer: el.id, ts: Date.now() }, false);
                    } else if (!isOpenNow && wasOpen) {
                        window._openModalOrder = window._openModalOrder.filter(id => id !== el.id);
                    }
                });
            });

            layerSpecs.forEach(({ el, cls }) => {
                if (!el || !el.id) return;
                el.dataset.backCls = cls;
                layerObs.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
            });
        };

        window.switchView = function(viewId, pushState = true) {
            window.syncHeaderHeight();
            const prevViewId = window.getCurrentViewId();
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
            const target = document.getElementById(viewId);
            if(target) target.classList.add('active');
            const headerEl = document.getElementById('header-wrapper');
            if (headerEl) headerEl.classList.remove('header-compact');
            if (viewId === 'view-formulare' && typeof window.ensureFormsLoaded === 'function') window.ensureFormsLoaded();
            if (viewId === 'view-ankauf' && typeof window.ensureCarsLoaded === 'function') window.ensureCarsLoaded();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (typeof window.updateHeaderNavActiveState === 'function') window.updateHeaderNavActiveState(viewId);
            const progBar = document.getElementById('headerScrollProgress');
            if (progBar) progBar.style.transform = 'scaleX(0)';
            
            if(pushState && viewId !== prevViewId) {
                const replaceMenuLayer = !!(history.state && history.state.redLayer);
                window.pushAppHistoryState({ view: viewId, ts: Date.now() }, replaceMenuLayer);
            }
        };

        window.addEventListener('popstate', (e) => {
            const prevState = window._lastHistoryState;
            window._lastHistoryState = e.state;

            // Schritt 1: Erst oberstes offenes Fenster / Menü / Auswahl-Sheet schließen
            if (window.closeTopmostUiLayer()) {
                if (e.state && e.state.redRoot) {
                    window.pushAppHistoryState({ view: 'view-home', redGuard: true }, false);
                }
                return;
            }

            const currentView = window.getCurrentViewId();
            const targetView = (e.state && e.state.view) ? e.state.view : 'view-home';

            // Schritt 2: Falls das vorherige Fenster schon per X geschlossen wurde, leeren Zwischenschritt überspringen
            if (prevState && prevState.redLayer && targetView === currentView && e.state && !e.state.redRoot) {
                history.back();
                return;
            }

            // Schritt 3: Zur vorherigen Unterseite bzw. Startseite wechseln
            if (targetView !== currentView) {
                window.switchView(targetView, false);
                return;
            }

            // Schritt 4: Auf Startseite ganz unten -> erst sanft nach oben scrollen
            if (currentView === 'view-home' && window.scrollY > 250) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (e.state && e.state.redRoot) {
                    window.pushAppHistoryState({ view: 'view-home', redGuard: true }, false);
                }
                return;
            }

            // Schritt 5: Ganz oben auf der Startseite -> 1× Hinweis statt sofortigem Rauswurf
            if (e.state && e.state.redRoot) {
                const now = Date.now();
                if (now - window._lastBackExitHint > 2500) {
                    window._lastBackExitHint = now;
                    window.showToast('Zum Verlassen erneut Zurück tippen', 'success');
                    clearTimeout(window._rearmGuardTimer);
                    window._rearmGuardTimer = setTimeout(() => {
                        if (history.state && history.state.redRoot && window.getCurrentViewId() === 'view-home') {
                            window.pushAppHistoryState({ view: 'view-home', redGuard: true }, false);
                        }
                    }, 2600);
                }
            }
        });
        
        window.toggleMenu = function() { document.getElementById('quickMenu').classList.toggle('active'); };
        
        window.openAdmin = function() { 
            document.getElementById('adminKeyBtn').classList.remove('new-alert');

            if(window.isAuthorized) {
                document.getElementById('adminModal').classList.add('open'); 
            } else {
                document.getElementById('authBox').style.display = 'block';
                document.getElementById('dashboardBox').style.display = 'none';
                document.getElementById('adminModal').classList.add('open'); 
            }
        };
        window.closeAdmin = function() { document.getElementById('adminModal').classList.remove('open'); };
        
        window.openSupervisorPanel = function() {
            window.updateSupervisorPermCounter();
            document.getElementById('supervisorPermsOverlay').classList.add('open');
        };
        window.closeSupervisorPanel = function() { document.getElementById('supervisorPermsOverlay').classList.remove('open'); };

        window.closeCustomConfirm = function() { document.getElementById('confirmModalOverlay').classList.remove('open'); };
        window.closeInfo = function() { document.getElementById('infoPopupOverlay').classList.remove('open'); };

        window.openLightbox = function(title, mediaUrl, opts = {}) {
            const titleEl = document.getElementById('lightboxTitle');
            const subEl = document.getElementById('lightboxSubtitle');
            const badgeEl = document.getElementById('lightboxBadgeLabel');
            const container = document.getElementById('lightboxImageContainer');

            if (titleEl) {
                titleEl.innerText = title || '';
                titleEl.style.color = opts.lightboxColor || 'var(--primary-red)';
                titleEl.style.fontFamily = opts.font || "'Montserrat', sans-serif";
            }
            if (subEl) {
                const subTxt = (opts.subtitle || '').trim();
                subEl.innerText = subTxt;
                subEl.style.display = subTxt ? 'block' : 'none';
            }
            if (badgeEl) {
                const bTxt = (opts.badge || 'RED Berlin Galerie').trim();
                badgeEl.innerHTML = `<i class="fa-solid fa-camera" style="color:var(--primary-red);"></i> ${window.escHtml(bTxt)}`;
            }

            if (mediaUrl.includes("data:video") || mediaUrl.endsWith(".mp4") || mediaUrl.startsWith("blob:")) {
                container.innerHTML = `<video src="${mediaUrl}" controls autoplay loop playsinline></video>`;
            } else {
                container.innerHTML = `<img src="${mediaUrl}" alt="${window.escHtml(title || 'RED Berlin')}">`;
            }
            document.getElementById('lightboxOverlay').classList.add('open');
        };
        window.closeLightbox = function() { document.getElementById('lightboxOverlay').classList.remove('open'); };

        window.toggleCardSlide = function(card, e) {
            if(e) e.stopPropagation();
            const isActive = card.classList.contains('reveal-active');
            document.querySelectorAll('.card').forEach(c => c.classList.remove('reveal-active'));
            if(!isActive) card.classList.add('reveal-active');
        };

        window.bookServiceFromCard = function(srvId) {
            const srv = (window.servicesData || []).find(s => s.id === srvId);
            if (!srv) return;
            window.selectedServiceVal = srv.title;
            const trig = document.getElementById('selectTriggerText');
            if (trig) trig.innerText = srv.title;
            window.updateBookingLiveSummary();
            document.querySelectorAll('.card').forEach(c => c.classList.remove('reveal-active'));
            document.getElementById('termin')?.scrollIntoView({ behavior: 'smooth' });
            window.showToast(`Leistung „${srv.title}“ im Terminformular vorausgewählt!`, 'success');
        };

        // =========================================================================
        // UNIVERSELLE DRAG-&-DROP ENGINE FÜR PINNWAND-KENNZEICHEN (MAUS + TOUCH)
        // =========================================================================
        window.makeDraggable = function(elmnt, id) {
            let startX = 0, startY = 0, initialLeft = 0, initialTop = 0, isDragging = false;

            const normalizePosition = () => {
                const rect = elmnt.getBoundingClientRect();
                elmnt.style.left = rect.left + 'px';
                elmnt.style.top = rect.top + 'px';
                elmnt.style.right = 'auto';
                elmnt.style.bottom = 'auto';
            };

            const onStart = (clientX, clientY, target) => {
                if (target && (target.classList.contains('unpin-plate-btn') || target.tagName === 'BUTTON' || target.tagName === 'I')) {
                    return false;
                }
                normalizePosition();
                isDragging = true;
                startX = clientX;
                startY = clientY;
                initialLeft = parseFloat(elmnt.style.left) || 0;
                initialTop = parseFloat(elmnt.style.top) || 0;
                elmnt.style.zIndex = 9999;
                return true;
            };

            const onMove = (clientX, clientY) => {
                if (!isDragging) return;
                const dx = clientX - startX;
                const dy = clientY - startY;
                const maxLeft = Math.max(10, window.innerWidth - elmnt.offsetWidth - 6);
                const maxTop = Math.max(10, window.innerHeight - elmnt.offsetHeight - 6);
                const newLeft = Math.min(Math.max(6, initialLeft + dx), maxLeft);
                const newTop = Math.min(Math.max(6, initialTop + dy), maxTop);
                elmnt.style.left = newLeft + 'px';
                elmnt.style.top = newTop + 'px';
            };

            const onEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                elmnt.style.zIndex = 9501;
                let positions = JSON.parse(localStorage.getItem('pin_positions') || '{}');
                positions[id] = { top: elmnt.style.top, left: elmnt.style.left };
                localStorage.setItem('pin_positions', JSON.stringify(positions));
            };

            // 1. Maus-Steuerung (PC / Mac)
            elmnt.addEventListener('mousedown', function(e) {
                if (!onStart(e.clientX, e.clientY, e.target)) return;
                e.preventDefault();
                const mouseMoveHandler = (ev) => onMove(ev.clientX, ev.clientY);
                const mouseUpHandler = () => {
                    document.removeEventListener('mousemove', mouseMoveHandler);
                    document.removeEventListener('mouseup', mouseUpHandler);
                    onEnd();
                };
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            });

            // 2. Touch-Steuerung (iPhone / iPad / Samsung / Android)
            elmnt.addEventListener('touchstart', function(e) {
                if (!e.touches || !e.touches[0]) return;
                if (!onStart(e.touches[0].clientX, e.touches[0].clientY, e.target)) return;
                e.preventDefault();
                const touchMoveHandler = (ev) => {
                    if (!ev.touches || !ev.touches[0]) return;
                    ev.preventDefault();
                    onMove(ev.touches[0].clientX, ev.touches[0].clientY);
                };
                const touchEndHandler = () => {
                    document.removeEventListener('touchmove', touchMoveHandler);
                    document.removeEventListener('touchend', touchEndHandler);
                    document.removeEventListener('touchcancel', touchEndHandler);
                    onEnd();
                };
                document.addEventListener('touchmove', touchMoveHandler, { passive: false });
                document.addEventListener('touchend', touchEndHandler);
                document.addEventListener('touchcancel', touchEndHandler);
            }, { passive: false });
        };

        // =========================================================================
        // 10. THEME-ADAPTIVES MOBILE SELECT-SHEET & GLOBALE KLAMMER-FORMATIERUNG
        // =========================================================================
        window.formatParenTextHtml = function(rawText, asNewLine = true) {
            const safe = window.escHtml(rawText || '')
                .replace(/(\d)\s+€/g, '$1&nbsp;€')
                .replace(/Britzer\s+Damm/g, 'Britzer&nbsp;Damm');

            return safe.replace(/(\s*)(\([^)]+\))([:?!.,;]*)/g, (match, sp, paren, punct, offset, fullStr) => {
                const isAtEnd = fullStr.slice(offset + match.length).trim() === '';
                if (asNewLine && isAtEnd) {
                    return `${punct}<span class="paren-sub">${paren}</span>`;
                }
                return `${sp}<span class="paren-inline">${paren}${punct}</span>`;
            });
        };

        // GEHEIMER ADMIN-ZUGANG (FÜR KUNDEN UNSICHTBAR: 5× FOOTER-TIPP, STRG+ALT+A ODER #admin)
        window.initSecretAdminAccess = function() {
            const footerTxt = document.getElementById('txt-footer-text');
            if (footerTxt && !footerTxt.dataset.secretBound) {
                footerTxt.dataset.secretBound = '1';
                footerTxt.style.userSelect = 'none';
                let tapCount = 0;
                let tapTimer = null;
                footerTxt.addEventListener('click', () => {
                    tapCount++;
                    clearTimeout(tapTimer);
                    if (tapCount >= 5) {
                        tapCount = 0;
                        window.openAdmin();
                    } else {
                        tapTimer = setTimeout(() => { tapCount = 0; }, 2200);
                    }
                });
            }

            if (!window._secretKeyBound) {
                window._secretKeyBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
                        e.preventDefault();
                        window.openAdmin();
                    }
                });
                const checkAdminHash = () => {
                    if (window.location.hash.toLowerCase() === '#admin') {
                        history.replaceState({ view: 'view-home' }, '', '#view-home');
                        window.openAdmin();
                    }
                };
                checkAdminHash();
                window.addEventListener('hashchange', checkAdminHash);
            }
        };

        window.activeMobileSelectEl = null;
        window.activeMobileSelectBtn = null;

        window.syncMobileSelectDisplay = function(selectEl) {
            if (!selectEl || !selectEl._mobileDisplayBtn) return;
            const opt = selectEl.options[selectEl.selectedIndex];
            const valWrap = selectEl._mobileDisplayBtn.querySelector('.ms-val-wrap');
            if (valWrap) {
                valWrap.innerHTML = opt ? window.formatParenTextHtml(opt.textContent.trim(), true) : 'Bitte wählen';
            }
        };

        window.syncAllMobileSelectDisplays = function() {
            document.querySelectorAll('select.form-control, select.theme-selector').forEach(sel => {
                window.syncMobileSelectDisplay(sel);
            });
        };

        window.openMobileSelectSheet = function(selectEl, triggerBtn) {
            const overlay = document.getElementById('mobileSelectOverlay');
            const listEl = document.getElementById('mobileSelectList');
            const titleEl = document.getElementById('mobileSelectTitle');
            if (!overlay || !listEl || !selectEl) return;

            window.activeMobileSelectEl = selectEl;
            window.activeMobileSelectBtn = triggerBtn;
            if (triggerBtn) triggerBtn.classList.add('active-open');

            const formGroup = selectEl.closest('.form-group');
            const lbl = formGroup ? formGroup.querySelector('label') : null;
            titleEl.innerText = lbl ? lbl.innerText.replace(/\s+/g, ' ').trim() : 'Auswahl treffen';

            listEl.innerHTML = '';
            let optIndex = 0;
            const appendOptionBtn = (opt) => {
                const idx = optIndex++;
                const isSelected = idx === selectEl.selectedIndex;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `mobile-select-option${isSelected ? ' selected' : ''}${opt.disabled ? ' is-disabled' : ''}`;
                btn.innerHTML = `
                    <span class="ms-opt-text">${window.formatParenTextHtml(opt.textContent.trim(), true)}</span>
                    <i class="${isSelected ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'} ms-opt-check"></i>
                `;
                if (!opt.disabled) {
                    btn.onclick = () => {
                        selectEl.selectedIndex = idx;
                        selectEl.value = opt.value;
                        window.syncMobileSelectDisplay(selectEl);
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                        window.closeMobileSelectSheet();
                    };
                }
                listEl.appendChild(btn);
            };

            Array.from(selectEl.children).forEach(child => {
                if (child.tagName === 'OPTGROUP') {
                    const grp = document.createElement('div');
                    grp.className = 'ms-group-label';
                    grp.textContent = child.label || '';
                    listEl.appendChild(grp);
                    Array.from(child.children).forEach(opt => { if (opt.tagName === 'OPTION') appendOptionBtn(opt); });
                } else if (child.tagName === 'OPTION') {
                    appendOptionBtn(child);
                }
            });

            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            if (overlay.parentElement !== document.body || document.body.lastElementChild !== overlay) {
                document.body.appendChild(overlay);
            }
            document.body.classList.add('mobile-select-active');
            overlay.classList.add('open');
            listEl.scrollTop = 0;
        };

        window.closeMobileSelectSheet = function() {
            const overlay = document.getElementById('mobileSelectOverlay');
            if (overlay) overlay.classList.remove('open');
            document.body.classList.remove('mobile-select-active');
            if (window.activeMobileSelectBtn) window.activeMobileSelectBtn.classList.remove('active-open');
            window.activeMobileSelectEl = null;
            window.activeMobileSelectBtn = null;
        };

        window.initMobileThemeSelects = function() {
            document.querySelectorAll('select.form-control, select.theme-selector').forEach(sel => {
                if (sel.dataset.mobileSelectReady) return;
                sel.dataset.mobileSelectReady = '1';

                const wrap = document.createElement('div');
                wrap.className = 'red-select-wrap';
                if (sel.id === 'themeSelector') wrap.classList.add('is-theme-select');
                else if (sel.style.flex) wrap.classList.add('is-flex-item');
                else if (sel.style.width && sel.style.width.includes('px')) wrap.classList.add('is-compact-item');

                sel.parentNode.insertBefore(wrap, sel);
                wrap.appendChild(sel);

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mobile-select-display';
                btn.innerHTML = `<span class="ms-val-wrap"></span><i class="fa-solid fa-chevron-down ms-chevron"></i>`;
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.openMobileSelectSheet(sel, btn);
                };
                wrap.appendChild(btn);
                sel._mobileDisplayBtn = btn;

                sel.addEventListener('change', () => window.syncMobileSelectDisplay(sel));
                window.syncMobileSelectDisplay(sel);
            });

            // Synchronisiert dynamisch gesetzte Werte beim Öffnen beliebiger Modals (nur mobil nötig)
            const modalObserver = new MutationObserver(() => {
                if (window.innerWidth <= 768) setTimeout(window.syncAllMobileSelectDisplays, 30);
            });
            document.querySelectorAll('.custom-dialog-overlay').forEach(ov => {
                modalObserver.observe(ov, { attributes: true, attributeFilter: ['class'] });
            });
        };

        // Aufklappbare Mobile Service-Leiste inkl. Blur-Hintergrund
        window.toggleMobileQuickBar = function(e) {
            if (e) e.stopPropagation();
            const bar = document.getElementById('floatingQuickBar');
            const btn = document.getElementById('fabMainToggle');
            const backdrop = document.getElementById('fabBackdrop');
            if (!bar) return;
            const isOpen = bar.classList.toggle('fab-open');
            if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (backdrop) backdrop.classList.toggle('open', isOpen);
        };
        window.closeMobileQuickBar = function() {
            const bar = document.getElementById('floatingQuickBar');
            const btn = document.getElementById('fabMainToggle');
            const backdrop = document.getElementById('fabBackdrop');
            if (bar) bar.classList.remove('fab-open');
            if (btn) btn.setAttribute('aria-expanded', 'false');
            if (backdrop) backdrop.classList.remove('open');
        };
        document.addEventListener('click', (e) => {
            const bar = document.getElementById('floatingQuickBar');
            if (bar && bar.classList.contains('fab-open') && !bar.contains(e.target)) {
                window.closeMobileQuickBar();
            }
        });

        // Globale Klammer-Formatierung (überall klein, Doppelpunkte am Wort oben, kein einsames ? oder .)
        window.formatParenthesesEverywhere = function(rootEl) {
            const root = rootEl || document.body;
            const blockTargets = root.querySelectorAll(
                '.form-group > label, .compass-tab-btn, .district-pill, .checklist-row span, .compass-doc-list li, .calc-item span, .download-info span, .tool-box h3, .compass-box h2, .compass-box h3, .section-header h2, #districtResultBox strong, #laboEnvResultBox strong, #pickupForecastResult strong, .tool-box > div > div'
            );
            blockTargets.forEach(el => {
                if (el.dataset.parenDone === '1' || el.closest('#adminModal') || el.closest('#liveGermanPlatePreview') || el.closest('#header-wrapper')) return;
                const textNodes = [];
                el.childNodes.forEach(n => {
                    if (n.nodeType === 3 && /\([^)]+\)/.test(n.nodeValue)) textNodes.push(n);
                });
                if (textNodes.length === 0) return;

                const isFlex = getComputedStyle(el).display.includes('flex');
                textNodes.forEach(node => {
                    const leadSpace = /^\s/.test(node.nodeValue) ? ' ' : '';
                    const html = leadSpace + window.formatParenTextHtml(node.nodeValue.trim(), true);
                    const holder = document.createElement('span');
                    holder.className = isFlex ? 'paren-text-group' : '';
                    holder.innerHTML = html;
                    node.parentNode.replaceChild(holder, node);
                });
                el.dataset.parenDone = '1';
            });

            // Fließtext- & FAQ-Klammern kleiner direkt im Satzfluss (ohne abgebrochenes ? oder .)
            root.querySelectorAll('p, .admin-details summary, .card-info-slide p, .admin-details-content, #districtResultBox span, #laboFeeResultDesc, #pickupForecastResult').forEach(p => {
                if (p.dataset.parenDone === '1' || p.closest('#adminModal') || p.closest('#legalOverlay') || p.closest('.cookie-box') || p.classList.contains('paren-sub') || p.classList.contains('paren-inline')) return;
                p.childNodes.forEach(node => {
                    if (node.nodeType === 3 && /\([^)]+\)/.test(node.nodeValue)) {
                        const span = document.createElement('span');
                        span.innerHTML = window.formatParenTextHtml(node.nodeValue, false);
                        node.parentNode.replaceChild(span, node);
                    }
                });
                p.dataset.parenDone = '1';
            });

            // Globaler Umbruch-Schutz für zusammengehörige Preisspannen, Uhrzeiten, Einheiten & Ortsnamen
            window.protectConnectedPhrases(root);
        };

        window.protectConnectedPhrases = function(rootEl) {
            const root = rootEl || document.body;
            const skipTags = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1 };
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (!parent || skipTags[parent.tagName] || parent.closest('#adminModal') || parent.closest('#liveGermanPlatePreview')) continue;
                const orig = node.nodeValue;
                if (!orig || orig.trim().length < 3) continue;

                const fixed = orig
                    // Preisspannen & Beträge untrennbar (z.B. ca. 26,00 € – 31,00 €)
                    .replace(/ca\.\s+(\d)/gi, 'ca.\u00A0$1')
                    .replace(/(\d)\s+€/g, '$1\u00A0€')
                    .replace(/€\s*([–-])\s*(\d)/g, '€\u00A0$1\u00A0$2')
                    // Uhrzeiten & Zeitspannen untrennbar (z.B. ab 09:00 Uhr, 09:00 – 20:00 Uhr)
                    .replace(/\b(ab|bis|um)\s+(\d{1,2}:\d{2})/gi, '$1\u00A0$2')
                    .replace(/(\d{1,2}:\d{2})\s*([–-])\s*(\d{1,2}:\d{2})/g, '$1\u00A0$2\u00A0$3')
                    .replace(/(\d{1,2}:\d{2})\s+Uhr\b/gi, '$1\u00A0Uhr')
                    // Zahlen + Einheiten untrennbar (z.B. 1–2 Werktage, 24 Stunden, 5 Min., 100 %, § 23 StVZO)
                    .replace(/(\d[\d.,–-]*)\s+(Werktage?n?|Tage?n?|Stunden?|Std\.|Minuten?|Min\.|Sekunden?|Zeichen|Jahre?n?|mm|km|%|Schritten?|Fahrzeuge?n?)\b/gi, '$1\u00A0$2')
                    .replace(/(\d+)\s*×\s*(\d+)/g, '$1\u00A0×\u00A0$2')
                    .replace(/§\s*(\d+)/g, '§\u00A0$1')
                    .replace(/\bTeil\s+(I{1,2})\b/g, 'Teil\u00A0$1')
                    .replace(/\bz\.\s?B\.\s+/g, 'z.\u00A0B.\u00A0')
                    // Feste Berliner Orts- & Firmenbegriffe
                    .replace(/Kienitzer\s+Str\.\s*6/g, 'Kienitzer\u00A0Str.\u00A06')
                    .replace(/12053\s+Berlin/g, '12053\u00A0Berlin')
                    .replace(/U8\s+(Boddinstraße|Boddinstr\.)/g, 'U8\u00A0$1')
                    .replace(/Britzer\s+Damm/g, 'Britzer\u00A0Damm')
                    .replace(/LABO\s+Berlin/g, 'LABO\u00A0Berlin')
                    .replace(/RED\s+Berlin/g, 'RED\u00A0Berlin')
                    .replace(/Tamer\s+Yazici/g, 'Tamer\u00A0Yazici');

                if (fixed !== orig) {
                    node.nodeValue = fixed;
                }
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            window.initSecretAdminAccess();
            window.initMobileThemeSelects();
            window.formatParenthesesEverywhere(document.body);
            setTimeout(() => {
                window.syncAllMobileSelectDisplays();
                window.formatParenthesesEverywhere(document.body);
            }, 400);

            // ESC-Taste schließt jederzeit sauber das oberste aktive Fenster / Menü / Select-Sheet
            if (!window._escHandlerBound) {
                window._escHandlerBound = true;
                document.addEventListener('keydown', (e) => {
                    if (e.key !== 'Escape') return;
                    const mobileSel = document.getElementById('mobileSelectOverlay');
                    if (mobileSel && mobileSel.classList.contains('open')) { window.closeMobileSelectSheet(); return; }
                    const qMenu = document.getElementById('quickMenu');
                    if (qMenu && qMenu.classList.contains('active')) { window.toggleMenu(); return; }
                    const qBar = document.getElementById('floatingQuickBar');
                    if (qBar && qBar.classList.contains('fab-open')) { window.closeMobileQuickBar(); return; }
                    document.querySelectorAll('.custom-dialog-overlay.open').forEach(ov => {
                        ov.classList.remove('open');
                        if (ov.id === 'widgetModalOverlay') window.closeWidgetModal();
                    });
                });
            }

            // Dynamische Ergebnis-Boxen automatisch nachformatieren, sobald der Nutzer klickt
            const dynamicIds = ['districtResultBox', 'laboEnvResultBox', 'pickupForecastResult', 'compassCaseTitle', 'compassCaseDesc', 'compassDocList', 'calcOptionsList'];
            const dynObs = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    if (m.target && m.target.nodeType === 1) {
                        m.target.removeAttribute('data-paren-done');
                        m.target.querySelectorAll('[data-paren-done]').forEach(c => c.removeAttribute('data-paren-done'));
                        window.formatParenthesesEverywhere(m.target);
                    }
                });
            });
            dynamicIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) dynObs.observe(el, { childList: true, subtree: false });
            });
        });

        // =========================================================================
        // RED BELEG-, RECHNUNGS- & DOKUMENTEN-SUITE PRO (CLOUD-SYNC + BRÜCKEN + AUTO-NR.)
        // =========================================================================
        let invSigCanvas = null, invSigCtx = null, isDrawingInvSig = false, hasDrawnInvSig = false;
        window.savedInvoicesData = JSON.parse(localStorage.getItem('red_saved_invoices_v1') || '[]');
        window.editingInvoiceId = null;
        window.invoiceArchiveFilter = 'all';
        window.invoiceCustomerFilter = null;
        window._pendingLoadedSigDataUrl = '';

        window.RED_DOC_TEMPLATES = {
            'RECHNUNG & BARQUITTUNG': { prefix: 'RE', label: 'Rechnung & Barquittung', defaultStatus: 'paid', isQuote: false },
            'RECHNUNG': { prefix: 'RE', label: 'Rechnung', defaultStatus: 'paid', isQuote: false },
            'BARQUITTUNG': { prefix: 'QU', label: 'Barquittung', defaultStatus: 'paid', isQuote: false },
            'ANGEBOT': { prefix: 'AN', label: 'Angebot', defaultStatus: 'quote', isQuote: true },
            'KOSTENVORANSCHLAG': { prefix: 'KV', label: 'Kostenvoranschlag', defaultStatus: 'quote', isQuote: true },
            'AUFTRAGSBESTÄTIGUNG': { prefix: 'AB', label: 'Auftragsbestätigung', defaultStatus: 'open', isQuote: false },
            'ÜBERGABEPROTOKOLL': { prefix: 'UP', label: 'Übergabeprotokoll', defaultStatus: 'paid', isQuote: false },
            'GUTSCHRIFT / STORNO': { prefix: 'GS', label: 'Gutschrift / Storno', defaultStatus: 'paid', isQuote: false }
        };

        window.getDocTemplateMeta = function(docTitle) {
            return window.RED_DOC_TEMPLATES[docTitle] || window.RED_DOC_TEMPLATES['RECHNUNG & BARQUITTUNG'];
        };

        window.canAccessCashInvoice = function() {
            return document.body.classList.contains('is-supervisor') ||
                (document.body.classList.contains('is-admin') && window.adminPermissions?.invoice === true);
        };

        window.openRedDeleteConfirm = function(title, desc, onConfirm) {
            window.deleteTargetId = null;
            window.deleteNoteTargetId = null;
            window._customConfirmCallback = onConfirm;
            const ov = document.getElementById('deleteConfirmOverlay');
            if (!ov) { if (onConfirm) onConfirm(); return; }
            const t = document.getElementById('delTitleText');
            const d = document.getElementById('delDescText');
            if (t) t.innerText = title || 'Eintrag löschen?';
            if (d) d.innerText = desc || 'Möchten Sie diesen Datensatz wirklich entfernen?';
            if (ov.parentElement !== document.body || document.body.lastElementChild !== ov) {
                document.body.appendChild(ov);
            }
            ov.style.zIndex = '99998';
            ov.classList.add('open');
        };

        window.getInvoicesForCustomer = function(clientObj) {
            if (!clientObj) return [];
            const cid = String(clientObj.clientId || '').trim();
            const cName = String(clientObj.name || '').trim().toLowerCase();
            const cPhone = String(clientObj.phone || '').replace(/\D/g, '');
            return (window.savedInvoicesData || []).filter(inv => {
                if (cid && inv.clientId && String(inv.clientId).trim() === cid) return true;
                const invName = String(inv.custName || '').trim().toLowerCase();
                if (cName && invName && invName === cName) return true;
                const invPhone = String(inv.custPhone || '').replace(/\D/g, '');
                if (cPhone.length >= 6 && invPhone.length >= 6 && invPhone === cPhone) return true;
                return false;
            });
        };

        window.openInvoicesForCrmClient = function(clientId, startCreate = false) {
            if (!window.canAccessCashInvoice()) {
                window.showToast('Der Supervisor hat die Beleg- & Rechnungsfunktion nicht freigeschaltet.', 'error');
                return;
            }
            const client = (window.crmClientsDetail || {})[clientId];
            if (!client) return;

            window.invoiceCustomerFilter = {
                clientId: client.clientId,
                name: client.name || 'Kunde',
                phone: client.phone || '',
                address: [client.address, client.city].filter(Boolean).join(', ')
            };

            const existing = window.getInvoicesForCustomer(client);
            if (startCreate || existing.length === 0) {
                window.resetCashInvoiceForm(true);
                window.applyCustomerToInvoiceForm(window.invoiceCustomerFilter);
                window.openCashInvoiceModal('create');
                if (!startCreate) {
                    window.showToast(`Noch keine Belege für ${client.name} – direkt neu anlegen.`, 'success');
                }
            } else {
                window.openCashInvoiceModal('archive');
            }
        };

        window.applyCustomerToInvoiceForm = function(cust) {
            if (!cust) return;
            if (document.getElementById('invLinkedClientId')) document.getElementById('invLinkedClientId').value = cust.clientId || '';
            if (document.getElementById('invCustomerName')) document.getElementById('invCustomerName').value = cust.name || '';
            if (document.getElementById('invCustomerPhone')) document.getElementById('invCustomerPhone').value = cust.phone || '';
            if (document.getElementById('invCustomerAddress')) document.getElementById('invCustomerAddress').value = cust.address || '';
            window.updateInvoiceFormBridges();
        };

        window.clearInvoiceCustomerFilter = function() {
            window.invoiceCustomerFilter = null;
            window.renderSavedInvoicesArchive();
        };

        window.createNewInvoiceForFilteredCustomer = function() {
            const cust = window.invoiceCustomerFilter;
            window.resetCashInvoiceForm(true);
            if (cust) window.applyCustomerToInvoiceForm(cust);
            window.switchInvoiceTab('create');
        };

        window.createNewInvoiceFromArchiveFooter = function() {
            if (window.invoiceCustomerFilter) {
                window.createNewInvoiceForFilteredCustomer();
            } else {
                window.resetCashInvoiceForm();
                window.switchInvoiceTab('create');
            }
        };

        window.updateInvoiceCountBadges = function() {
            const count = (window.savedInvoicesData || []).length;
            const hdrBadge = document.getElementById('adminInvoicesCountBadge');
            const tabBadge = document.getElementById('invArchiveTabCount');
            if (hdrBadge) hdrBadge.innerText = String(count);
            if (tabBadge) tabBadge.innerText = String(count);
        };

        window.getNextInvoiceNumber = function(docTitleOverride = '') {
            const docTitle = docTitleOverride || document.getElementById('invDocTitle')?.value || 'RECHNUNG & BARQUITTUNG';
            const meta = window.getDocTemplateMeta(docTitle);
            const yr = window.getDynamicSystemYear();
            const fullPrefix = `${meta.prefix}-${yr}-`;

            let maxNum = 0;
            (window.savedInvoicesData || []).forEach(inv => {
                if (inv.invNo && String(inv.invNo).startsWith(fullPrefix)) {
                    const n = parseInt(String(inv.invNo).slice(fullPrefix.length), 10);
                    if (!isNaN(n) && n > maxNum) maxNum = n;
                }
            });
            return `${fullPrefix}${String(maxNum + 1).padStart(4, '0')}`;
        };

        // Automatische, lückenlose Neu-Nummerierung einer Serie (z.B. nach Löschen oder Belegart-Wechsel)
        window.resequenceInvoicesForPrefix = function(prefix, year) {
            const fullPrefix = `${prefix}-${year}-`;
            const matching = (window.savedInvoicesData || []).filter(inv => inv.invNo && String(inv.invNo).startsWith(fullPrefix));
            matching.sort((a, b) => (a.createdAt || a.updatedAt || 0) - (b.createdAt || b.updatedAt || 0));
            matching.forEach((inv, i) => {
                inv.invNo = `${fullPrefix}${String(i + 1).padStart(4, '0')}`;
            });
        };

        window.onInvoiceDocTypeChange = function() {
            const docTitle = document.getElementById('invDocTitle')?.value || 'RECHNUNG & BARQUITTUNG';
            const meta = window.getDocTemplateMeta(docTitle);
            const curNo = (document.getElementById('invNumber')?.value || '').trim();
            const yr = window.getDynamicSystemYear();
            const expectedPrefix = `${meta.prefix}-${yr}-`;

            // Nummer automatisch an die neue Beleg-Art anpassen (bei Neu oder Typwechsel)
            if (!curNo || !curNo.startsWith(expectedPrefix)) {
                document.getElementById('invNumber').value = window.getNextInvoiceNumber(docTitle);
            }

            const validGrp = document.getElementById('invValidUntilGroup');
            const validInp = document.getElementById('invValidUntil');
            if (validGrp) validGrp.style.display = meta.isQuote ? 'block' : 'none';
            if (meta.isQuote && validInp && !validInp.value) {
                const plus14 = new Date(Date.now() + 14 * 86400000);
                validInp.value = plus14.toLocaleDateString('de-DE');
            }

            const paySel = document.getElementById('invPayStatus');
            if (paySel && !window.editingInvoiceId) {
                paySel.value = meta.defaultStatus;
                if (typeof window.syncMobileSelectDisplay === 'function') window.syncMobileSelectDisplay(paySel);
            }
            window.updateInvoiceEditBanner();
        };

        window.persistSavedInvoices = async function() {
            localStorage.setItem('red_saved_invoices_v1', JSON.stringify(window.savedInvoicesData));
            window.updateInvoiceCountBadges();
            window.renderSavedInvoicesArchive();
            if (document.getElementById('crmOverlay')?.classList.contains('open') && typeof window.renderCRM === 'function') {
                window.renderCRM();
            }
            if (window.firebaseDb && window.firebaseSetDoc) {
                try {
                    await window.firebaseSetDoc(
                        window.firebaseDoc(window.firebaseDb, "settings", "invoices_archive"),
                        { list: window.savedInvoicesData, updatedAt: Date.now() },
                        { merge: true }
                    );
                } catch (e) {
                    console.error('Rechnungs-Archiv Sync Fehler:', e);
                }
            }
        };

        window.initInvoiceSignaturePad = function(restoreDataUrl = '') {
            invSigCanvas = document.getElementById('invSignatureCanvas');
            if (!invSigCanvas) return;
            const rect = invSigCanvas.parentElement.getBoundingClientRect();
            if (!rect.width || rect.width < 40) return;

            const prevData = restoreDataUrl || window._pendingLoadedSigDataUrl || (hasDrawnInvSig ? invSigCanvas.toDataURL('image/png') : '');
            const targetW = Math.floor(rect.width);
            const targetH = Math.floor(rect.height || 112);
            if (invSigCanvas.width !== targetW || invSigCanvas.height !== targetH || restoreDataUrl || window._pendingLoadedSigDataUrl) {
                invSigCanvas.width = targetW;
                invSigCanvas.height = targetH;
            }
            invSigCtx = invSigCanvas.getContext('2d');
            invSigCtx.strokeStyle = '#001a66';
            invSigCtx.lineWidth = 2.4;
            invSigCtx.lineCap = 'round';
            invSigCtx.lineJoin = 'round';

            if (prevData && prevData.startsWith('data:image')) {
                const img = new Image();
                img.onload = () => {
                    invSigCtx.drawImage(img, 0, 0, invSigCanvas.width, invSigCanvas.height);
                    hasDrawnInvSig = true;
                };
                img.src = prevData;
                window._pendingLoadedSigDataUrl = '';
            }

            const getPos = (e) => {
                const r = invSigCanvas.getBoundingClientRect();
                const cx = e.touches ? e.touches[0].clientX : e.clientX;
                const cy = e.touches ? e.touches[0].clientY : e.clientY;
                return { x: cx - r.left, y: cy - r.top };
            };
            const start = (e) => {
                e.preventDefault();
                isDrawingInvSig = true;
                hasDrawnInvSig = true;
                const p = getPos(e);
                invSigCtx.beginPath();
                invSigCtx.moveTo(p.x, p.y);
            };
            const move = (e) => {
                if (!isDrawingInvSig) return;
                e.preventDefault();
                const p = getPos(e);
                invSigCtx.lineTo(p.x, p.y);
                invSigCtx.stroke();
            };
            const end = () => { isDrawingInvSig = false; };

            invSigCanvas.onmousedown = start;
            invSigCanvas.onmousemove = move;
            invSigCanvas.ontouchstart = start;
            invSigCanvas.ontouchmove = move;
            invSigCanvas.ontouchend = end;
            if (!window._invSigMouseUpBound) {
                window._invSigMouseUpBound = true;
                window.addEventListener('mouseup', () => { isDrawingInvSig = false; });
            }
        };

        window.clearInvoiceSignature = function() {
            window._pendingLoadedSigDataUrl = '';
            hasDrawnInvSig = false;
            if (!invSigCanvas || !invSigCtx) return;
            invSigCtx.clearRect(0, 0, invSigCanvas.width, invSigCanvas.height);
        };

        window.updateInvoiceFormBridges = function() {
            const row = document.getElementById('invFormBridgeRow');
            if (!row) return;
            const cid = (document.getElementById('invLinkedClientId')?.value || '').trim();
            const phone = (document.getElementById('invCustomerPhone')?.value || '').replace(/\D/g, '');
            row.style.display = (cid || phone.length >= 6) ? 'flex' : 'none';
        };

        window.jumpFromInvoiceToCrm = function() {
            const cid = (document.getElementById('invLinkedClientId')?.value || '').trim();
            if (cid && (window.crmClientsDetail || {})[cid]) {
                window.closeCashInvoiceModal();
                window.openCRM();
                setTimeout(() => window.openCRMDetail(cid), 120);
                return;
            }
            const name = (document.getElementById('invCustomerName')?.value || '').trim().toLowerCase();
            const found = Object.values(window.crmClientsDetail || {}).find(c => String(c.name || '').trim().toLowerCase() === name);
            if (found) {
                window.closeCashInvoiceModal();
                window.openCRM();
                setTimeout(() => window.openCRMDetail(found.clientId), 120);
            } else {
                window.showToast('Kein verknüpfter CRM-Eintrag gefunden.', 'error');
            }
        };

        window.sendInvoiceRecordToWhatsApp = function(rec) {
            if (!rec) return;
            const digits = String(rec.custPhone || '').replace(/\D/g, '');
            if (digits.length < 6) {
                window.showToast('Bitte zuerst eine Telefonnummer beim Kunden hinterlegen.', 'error');
                return;
            }
            const waNum = digits.replace(/^0/, '49');
            const itemsText = (rec.items || []).map(i => `• ${i.qty}× ${i.desc}: ${window.formatEuroDE(i.lineTotal)}`).join('\n');
            const statusText = rec.payStatus === 'paid'
                ? 'Status: Betrag dankend in Bar erhalten ✅'
                : (rec.payStatus === 'quote' ? `Unverbindlich${rec.validUntil ? ' • Gültig bis ' + rec.validUntil : ''}` : 'Zahlungsart: Barzahlung bei Übergabe');
            const msg = `📄 *${rec.docTitle} (${rec.invNo})*\n*RED Zulassungsdienst Berlin*\n\nHallo ${rec.custName},\nanbei Ihre Beleg-Übersicht vom ${rec.invDate}${rec.plate ? ' (' + rec.plate + ')' : ''}:\n\n${itemsText}\n\n*Gesamtbetrag:* ${window.formatEuroDE(rec.total)}\n${statusText}\n\n📍 Kienitzer Str. 6, 12053 Berlin\n📞 0178 378 38 75`;
            window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        };

        window.sendCurrentInvoiceToWhatsApp = function() {
            const rec = window.collectCashInvoiceRecord();
            if (!rec) { window.showToast('Bitte mindestens eine Position eintragen.', 'error'); return; }
            window.sendInvoiceRecordToWhatsApp(rec);
        };

        window.convertCurrentDocToInvoice = function() {
            const docSel = document.getElementById('invDocTitle');
            const paySel = document.getElementById('invPayStatus');
            window.editingInvoiceId = null;
            if (docSel) docSel.value = 'RECHNUNG & BARQUITTUNG';
            if (paySel) paySel.value = 'paid';
            document.getElementById('invDate').value = new Date().toLocaleDateString('de-DE');
            document.getElementById('invNumber').value = window.getNextInvoiceNumber('RECHNUNG & BARQUITTUNG');
            const validGrp = document.getElementById('invValidUntilGroup');
            if (validGrp) validGrp.style.display = 'none';
            window.updateInvoiceEditBanner();
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            window.showToast('Als neue Bar-Rechnung übernommen – jetzt Speichern oder PDF klicken!', 'success');
        };

        window.switchInvoiceTab = function(tabName) {
            const isArchive = (tabName === 'archive');
            document.getElementById('invTabBtnCreate')?.classList.toggle('active', !isArchive);
            document.getElementById('invTabBtnArchive')?.classList.toggle('active', isArchive);
            document.getElementById('invPaneCreate')?.classList.toggle('active', !isArchive);
            document.getElementById('invPaneArchive')?.classList.toggle('active', isArchive);

            const createFoot = document.getElementById('invCreateFooter');
            const archFoot = document.getElementById('invArchiveFooter');
            if (createFoot) createFoot.style.display = isArchive ? 'none' : 'flex';
            if (archFoot) archFoot.style.display = isArchive ? 'flex' : 'none';

            const scrollBody = document.getElementById('invModalScrollBody');
            if (scrollBody) scrollBody.scrollTop = 0;
            const invOv = document.getElementById('cashInvoiceOverlay');
            if (invOv) invOv.scrollTop = 0;

            if (isArchive) {
                window.renderSavedInvoicesArchive();
            } else {
                requestAnimationFrame(() => {
                    window.initInvoiceSignaturePad();
                    if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
                });
            }
        };

        window.populateInvoiceQuickPick = function() {
            const sel = document.getElementById('invClientQuickPick');
            if (!sel) return;
            sel.innerHTML = '<option value="">— Manuell eingeben —</option>';

            const apts = (window.redApts || []).slice(0, 25);
            if (apts.length) {
                const grpApt = document.createElement('optgroup');
                grpApt.label = '📅 Aktuelle Termine';
                apts.forEach((a, idx) => {
                    const opt = document.createElement('option');
                    opt.value = `apt:${idx}`;
                    opt.textContent = `${a.name || 'Kunde'} (${a.service || '-'})`;
                    grpApt.appendChild(opt);
                });
                sel.appendChild(grpApt);
            }

            const clients = Object.values(window.crmClientsDetail || {}).slice(0, 40);
            if (clients.length) {
                const grpCrm = document.createElement('optgroup');
                grpCrm.label = '🗂️ RED Kundendatenbank (CRM)';
                clients.forEach((c) => {
                    const opt = document.createElement('option');
                    opt.value = `crm:${c.clientId}`;
                    opt.textContent = `${c.name || 'Kunde'} (${c.clientId})`;
                    grpCrm.appendChild(opt);
                });
                sel.appendChild(grpCrm);
            }
            if (typeof window.syncMobileSelectDisplay === 'function') window.syncMobileSelectDisplay(sel);
        };

        window.fillInvoiceFromQuickPick = function(val) {
            if (!val) return;
            if (val.startsWith('apt:')) {
                const idx = parseInt(val.split(':')[1], 10);
                const apt = (window.redApts || [])[idx];
                if (!apt) return;
                document.getElementById('invCustomerName').value = apt.name || '';
                document.getElementById('invCustomerPhone').value = apt.phone || '';
                document.getElementById('invPlate').value = apt.wunschkennzeichen || '';
                const matchedCrm = Object.values(window.crmClientsDetail || {}).find(c =>
                    (apt.phone && c.phone && c.phone.replace(/\D/g, '') === apt.phone.replace(/\D/g, '')) ||
                    (apt.name && c.name && c.name.trim().toLowerCase() === apt.name.trim().toLowerCase())
                );
                document.getElementById('invLinkedClientId').value = matchedCrm ? matchedCrm.clientId : '';
                if (matchedCrm) {
                    document.getElementById('invCustomerAddress').value = [matchedCrm.address, matchedCrm.city].filter(Boolean).join(', ');
                }
                if (apt.service) {
                    const cont = document.getElementById('invItemsContainer');
                    if (cont) cont.innerHTML = '';
                    const srvMatch = (window.servicesData || []).find(s => apt.service.toLowerCase().includes(s.title.toLowerCase()));
                    const matchedPrice = srvMatch && !isNaN(parseFloat(srvMatch.price)) ? parseFloat(srvMatch.price) : 0;
                    window.addInvoiceRow(apt.service, 1, matchedPrice);
                }
            } else if (val.startsWith('crm:')) {
                const cid = val.substring(4);
                const c = (window.crmClientsDetail || {})[cid];
                if (!c) return;
                document.getElementById('invLinkedClientId').value = c.clientId || '';
                document.getElementById('invCustomerName').value = c.name || '';
                document.getElementById('invCustomerPhone').value = c.phone || '';
                document.getElementById('invCustomerAddress').value = [c.address, c.city].filter(Boolean).join(', ');
            }
            window.updateInvoiceFormBridges();
        };

        window.addInvoiceRow = function(desc = '', qty = 1, unitPrice = 0) {
            const container = document.getElementById('invItemsContainer');
            if (!container) return;
            const row = document.createElement('div');
            row.className = 'inv-item-card';
            row.innerHTML = `
                <div class="inv-col-desc">
                    <span class="inv-item-sublabel">Leistung / Bezeichnung</span>
                    <input type="text" class="form-control inv-desc" placeholder="Leistung / Artikel" value="${window.escHtml(desc)}">
                </div>
                <div>
                    <span class="inv-item-sublabel">Menge</span>
                    <input type="number" class="form-control inv-qty" min="1" step="1" value="${qty}" oninput="window.recalcCashInvoice()">
                </div>
                <div>
                    <span class="inv-item-sublabel">Einzelpreis (€)</span>
                    <input type="text" inputmode="decimal" class="form-control inv-price" placeholder="0,00" value="${unitPrice ? String(unitPrice).replace('.', ',') : ''}" oninput="window.recalcCashInvoice()">
                </div>
                <button type="button" class="inv-del-row-btn" onclick="this.parentElement.remove(); window.recalcCashInvoice();" title="Entfernen"><i class="fa-solid fa-trash"></i></button>
            `;
            container.appendChild(row);
            window.recalcCashInvoice();
        };

        window.parseEuroInput = function(raw) {
            const num = parseFloat(String(raw || '0').replace(/\s+/g, '').replace(',', '.'));
            return isNaN(num) || num < 0 ? 0 : num;
        };

        window.formatEuroDE = function(val) {
            return Number(val || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        };

        window.recalcCashInvoice = function() {
            const rows = document.querySelectorAll('#invItemsContainer .inv-item-card');
            let subTotal = 0;
            rows.forEach(r => {
                const qty = Math.max(1, parseFloat(r.querySelector('.inv-qty')?.value || '1') || 1);
                const price = window.parseEuroInput(r.querySelector('.inv-price')?.value);
                subTotal += qty * price;
            });

            const discount = window.parseEuroInput(document.getElementById('invDiscount')?.value);
            const total = Math.max(0, subTotal - discount);

            const taxMode = document.getElementById('invTaxMode')?.value || 'mwst19';
            const totalEl = document.getElementById('invLiveTotal');
            const hintEl = document.getElementById('invLiveTaxHint');
            if (totalEl) totalEl.innerText = window.formatEuroDE(total);

            if (hintEl) {
                const discPart = discount > 0 ? `inkl. −${window.formatEuroDE(discount)} Rabatt • ` : '';
                if (taxMode === 'mwst19') {
                    const netto = total / 1.19;
                    const mwst = total - netto;
                    hintEl.innerText = `${discPart}Netto ${window.formatEuroDE(netto)} • 19% MwSt. ${window.formatEuroDE(mwst)}`;
                } else if (taxMode === 'klein') {
                    hintEl.innerText = `${discPart}§ 19 UStG (ohne MwSt.)`;
                } else {
                    hintEl.innerText = `${discPart}Inkl. Service & Amtsgebühren`;
                }
            }
            return total;
        };

        window.updateInvoiceEditBanner = function() {
            const banner = document.getElementById('invEditingBanner');
            const codeLbl = document.getElementById('invEditingCodeLabel');
            const tabLbl = document.getElementById('invTabCreateLabel');
            const convBtn = document.getElementById('invConvertToRechnungBtn');
            const docTitle = document.getElementById('invDocTitle')?.value || '';
            const isQuote = window.getDocTemplateMeta(docTitle).isQuote;

            if (window.editingInvoiceId) {
                if (banner) banner.classList.add('active');
                if (codeLbl) codeLbl.innerText = document.getElementById('invNumber')?.value || '';
                if (tabLbl) tabLbl.innerText = 'Beleg bearbeiten';
                if (convBtn) convBtn.style.display = isQuote ? 'inline-flex' : 'none';
            } else {
                if (banner) banner.classList.remove('active');
                if (tabLbl) tabLbl.innerText = 'Neu erstellen';
                if (convBtn) convBtn.style.display = 'none';
            }
        };

        window.resetCashInvoiceForm = function(keepCustomerFilter = false) {
            window.editingInvoiceId = null;
            if (!keepCustomerFilter) window.invoiceCustomerFilter = null;
            document.getElementById('invDocTitle').value = 'RECHNUNG & BARQUITTUNG';
            document.getElementById('invNumber').value = window.getNextInvoiceNumber('RECHNUNG & BARQUITTUNG');
            document.getElementById('invDate').value = new Date().toLocaleDateString('de-DE');
            document.getElementById('invLinkedClientId').value = '';
            document.getElementById('invCustomerName').value = '';
            document.getElementById('invCustomerPhone').value = '';
            document.getElementById('invCustomerAddress').value = '';
            document.getElementById('invPlate').value = '';
            document.getElementById('invVin').value = '';
            document.getElementById('invValidUntil').value = '';
            document.getElementById('invDiscount').value = '';
            document.getElementById('invNote').value = '';
            document.getElementById('invTaxMode').value = 'mwst19';
            document.getElementById('invPayStatus').value = 'paid';
            if (document.getElementById('invLogoStyle')) document.getElementById('invLogoStyle').value = 'round_text';
            if (document.getElementById('invStampStyle')) document.getElementById('invStampStyle').value = 'classic';
            if (document.getElementById('invOptSigLines')) document.getElementById('invOptSigLines').checked = true;
            const validGrp = document.getElementById('invValidUntilGroup');
            if (validGrp) validGrp.style.display = 'none';
            const pick = document.getElementById('invClientQuickPick');
            if (pick) pick.value = '';
            const cont = document.getElementById('invItemsContainer');
            if (cont) cont.innerHTML = '';
            window.addInvoiceRow('Anmeldung mit Wunschkennzeichen (inkl. Gebühren, Schilder & Plakette)', 1, 100);
            window.clearInvoiceSignature();
            window.updateInvoiceEditBanner();
            window.updateInvoiceFormBridges();
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
        };

        window.openCashInvoiceModal = function(startTab = 'create') {
            if (!window.canAccessCashInvoice()) {
                window.showToast('Der Supervisor hat die Bar-Rechnung für dieses Konto nicht freigeschaltet.', 'error');
                return;
            }
            window.populateInvoiceQuickPick();
            window.updateInvoiceCountBadges();

            if (!window.editingInvoiceId) {
                document.getElementById('invNumber').value = window.getNextInvoiceNumber();
            }
            if (!document.getElementById('invDate').value) {
                document.getElementById('invDate').value = new Date().toLocaleDateString('de-DE');
            }
            if (!document.querySelectorAll('#invItemsContainer .inv-item-card').length) {
                window.addInvoiceRow('Anmeldung mit Wunschkennzeichen (inkl. Gebühren, Schilder & Plakette)', 1, 100);
            }
            window.updateInvoiceEditBanner();
            window.updateInvoiceFormBridges();
            document.body.classList.add('invoice-modal-open');
            const invOv = document.getElementById('cashInvoiceOverlay');
            if (invOv) {
                invOv.classList.add('open');
                invOv.scrollTop = 0;
            }
            window.switchInvoiceTab(startTab === 'archive' ? 'archive' : 'create');
            requestAnimationFrame(() => {
                window.recalcCashInvoice();
                if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            });
        };

        window.closeCashInvoiceModal = function() {
            document.getElementById('cashInvoiceOverlay').classList.remove('open');
            document.body.classList.remove('invoice-modal-open');
        };

        window.collectCashInvoiceRecord = function() {
            const rows = Array.from(document.querySelectorAll('#invItemsContainer .inv-item-card'));
            const items = rows.map(r => {
                const desc = (r.querySelector('.inv-desc')?.value || '').trim();
                const qty = Math.max(1, parseFloat(r.querySelector('.inv-qty')?.value || '1') || 1);
                const unitPrice = window.parseEuroInput(r.querySelector('.inv-price')?.value);
                return { desc, qty, unitPrice, lineTotal: qty * unitPrice };
            }).filter(i => i.desc !== '' || i.lineTotal > 0);

            if (items.length === 0) return null;
            const subTotal = items.reduce((s, i) => s + i.lineTotal, 0);
            const discount = window.parseEuroInput(document.getElementById('invDiscount')?.value);
            const total = Math.max(0, subTotal - discount);
            const sigDataUrl = (invSigCanvas && hasDrawnInvSig) ? invSigCanvas.toDataURL('image/png') : '';

            const custName = (document.getElementById('invCustomerName')?.value || '').trim() || 'Barverkauf / Laufkunde';
            const custPhone = (document.getElementById('invCustomerPhone')?.value || '').trim();
            let linkedClientId = (document.getElementById('invLinkedClientId')?.value || '').trim();

            if (!linkedClientId && custName !== 'Barverkauf / Laufkunde') {
                const cleanDigits = custPhone.replace(/\D/g, '');
                const matchCrm = Object.values(window.crmClientsDetail || {}).find(c =>
                    (cleanDigits.length >= 6 && c.phone && c.phone.replace(/\D/g, '') === cleanDigits) ||
                    (c.name && c.name.trim().toLowerCase() === custName.toLowerCase())
                );
                if (matchCrm) linkedClientId = matchCrm.clientId;
            }

            const docTitle = document.getElementById('invDocTitle')?.value || 'RECHNUNG & BARQUITTUNG';
            return {
                id: window.editingInvoiceId || ('inv-' + Date.now()),
                clientId: linkedClientId,
                docTitle,
                invNo: (document.getElementById('invNumber')?.value || '').trim() || window.getNextInvoiceNumber(docTitle),
                invDate: (document.getElementById('invDate')?.value || '').trim() || new Date().toLocaleDateString('de-DE'),
                validUntil: (document.getElementById('invValidUntil')?.value || '').trim(),
                custName,
                custPhone,
                custAddr: (document.getElementById('invCustomerAddress')?.value || '').trim(),
                plate: (document.getElementById('invPlate')?.value || '').trim().toUpperCase(),
                vin: (document.getElementById('invVin')?.value || '').trim().toUpperCase(),
                note: (document.getElementById('invNote')?.value || '').trim(),
                taxMode: document.getElementById('invTaxMode')?.value || 'mwst19',
                payStatus: document.getElementById('invPayStatus')?.value || 'paid',
                logoStyle: document.getElementById('invLogoStyle')?.value || 'round_text',
                stampStyle: document.getElementById('invStampStyle')?.value || 'classic',
                showLogo: (document.getElementById('invLogoStyle')?.value || 'round_text') !== 'none',
                showStamp: (document.getElementById('invStampStyle')?.value || 'classic') !== 'none',
                showSigLines: document.getElementById('invOptSigLines')?.checked !== false,
                sigDataUrl,
                items,
                subTotal,
                discount,
                total,
                updatedAt: Date.now()
            };
        };

        window.saveCurrentCashInvoice = async function(openPdfAfter = false) {
            if (!window.canAccessCashInvoice()) {
                window.showToast('Keine Berechtigung für Bar-Rechnungen.', 'error');
                return;
            }
            const record = window.collectCashInvoiceRecord();
            if (!record) {
                window.showToast('Bitte mindestens eine Position mit Betrag eintragen.', 'error');
                return;
            }

            const existingIdx = (window.savedInvoicesData || []).findIndex(x => x.id === record.id);
            let oldPrefixToClean = null;
            if (existingIdx > -1) {
                const prevRec = window.savedInvoicesData[existingIdx];
                record.createdAt = prevRec.createdAt || record.updatedAt;
                const prevMatch = String(prevRec.invNo || '').match(/^([A-Z]+)-(\d{4})-/);
                const newMatch = String(record.invNo || '').match(/^([A-Z]+)-(\d{4})-/);
                if (prevMatch && (!newMatch || prevMatch[1] !== newMatch[1])) {
                    oldPrefixToClean = { prefix: prevMatch[1], year: prevMatch[2] };
                }
                window.savedInvoicesData[existingIdx] = record;
            } else {
                record.createdAt = Date.now();
                window.savedInvoicesData.unshift(record);
            }

            if (oldPrefixToClean) {
                window.resequenceInvoicesForPrefix(oldPrefixToClean.prefix, oldPrefixToClean.year);
            }

            window.editingInvoiceId = record.id;
            document.getElementById('invNumber').value = record.invNo;
            if (record.clientId) document.getElementById('invLinkedClientId').value = record.clientId;
            window.updateInvoiceEditBanner();
            window.updateInvoiceFormBridges();

            if (openPdfAfter) {
                window.renderCashInvoicePdfWindow(record);
            }

            await window.persistSavedInvoices();
            window.showToast(existingIdx > -1 ? `Beleg ${record.invNo} aktualisiert!` : `Beleg ${record.invNo} im Archiv gespeichert!`, 'success');
        };

        window.editSavedInvoice = function(invId) {
            const rec = (window.savedInvoicesData || []).find(x => x.id === invId);
            if (!rec) return;

            window.editingInvoiceId = rec.id;
            document.getElementById('invDocTitle').value = rec.docTitle || 'RECHNUNG & BARQUITTUNG';
            document.getElementById('invNumber').value = rec.invNo || '';
            document.getElementById('invDate').value = rec.invDate || '';
            document.getElementById('invLinkedClientId').value = rec.clientId || '';
            document.getElementById('invCustomerName').value = rec.custName || '';
            document.getElementById('invCustomerPhone').value = rec.custPhone || '';
            document.getElementById('invCustomerAddress').value = rec.custAddr || '';
            document.getElementById('invPlate').value = rec.plate || '';
            document.getElementById('invVin').value = rec.vin || '';
            document.getElementById('invValidUntil').value = rec.validUntil || '';
            document.getElementById('invDiscount').value = rec.discount ? String(rec.discount).replace('.', ',') : '';
            document.getElementById('invNote').value = rec.note || '';
            document.getElementById('invTaxMode').value = rec.taxMode || 'mwst19';
            document.getElementById('invPayStatus').value = rec.payStatus || 'paid';
            if (document.getElementById('invLogoStyle')) document.getElementById('invLogoStyle').value = rec.logoStyle || (rec.showLogo === false ? 'none' : 'round_text');
            if (document.getElementById('invStampStyle')) document.getElementById('invStampStyle').value = rec.stampStyle || (rec.showStamp === false ? 'none' : 'classic');
            if (document.getElementById('invOptSigLines')) document.getElementById('invOptSigLines').checked = rec.showSigLines !== false;

            const isQuote = window.getDocTemplateMeta(rec.docTitle).isQuote;
            const validGrp = document.getElementById('invValidUntilGroup');
            if (validGrp) validGrp.style.display = isQuote ? 'block' : 'none';

            const cont = document.getElementById('invItemsContainer');
            if (cont) cont.innerHTML = '';
            (rec.items || []).forEach(it => window.addInvoiceRow(it.desc, it.qty || 1, it.unitPrice || 0));

            window.clearInvoiceSignature();
            window._pendingLoadedSigDataUrl = rec.sigDataUrl || '';
            window.updateInvoiceEditBanner();
            window.updateInvoiceFormBridges();
            window.switchInvoiceTab('create');
            window.recalcCashInvoice();
            window.showToast(`Beleg ${rec.invNo} zum Bearbeiten geladen.`, 'success');
        };

        window.printSavedInvoiceById = function(invId) {
            const rec = (window.savedInvoicesData || []).find(x => x.id === invId);
            if (!rec) return;
            window.renderCashInvoicePdfWindow(rec);
        };

        window.toggleSavedInvoicePaid = async function(invId) {
            const idx = (window.savedInvoicesData || []).findIndex(x => x.id === invId);
            if (idx === -1) return;
            const nextStatus = window.savedInvoicesData[idx].payStatus === 'paid' ? 'open' : 'paid';
            window.savedInvoicesData[idx].payStatus = nextStatus;
            window.savedInvoicesData[idx].updatedAt = Date.now();
            await window.persistSavedInvoices();
            window.showToast(nextStatus === 'paid' ? 'Als Bar Bezahlt markiert!' : 'Auf Offen umgestellt.', 'success');
        };

        window.deleteSavedInvoice = function(invId) {
            const rec = (window.savedInvoicesData || []).find(x => x.id === invId);
            if (!rec) return;

            window.openRedDeleteConfirm(
                `Beleg ${rec.invNo} löschen?`,
                `Möchten Sie „${rec.docTitle}“ für ${rec.custName} (${window.formatEuroDE(rec.total)}) dauerhaft löschen? Die Beleg-Nummern werden automatisch lückenlos angepasst.`,
                async () => {
                    const numMatch = String(rec.invNo || '').match(/^([A-Z]+)-(\d{4})-/);
                    window.savedInvoicesData = (window.savedInvoicesData || []).filter(x => x.id !== invId);

                    if (numMatch) {
                        window.resequenceInvoicesForPrefix(numMatch[1], numMatch[2]);
                    }
                    if (window.editingInvoiceId === invId) {
                        window.resetCashInvoiceForm(true);
                    } else if (!window.editingInvoiceId) {
                        document.getElementById('invNumber').value = window.getNextInvoiceNumber();
                    }

                    await window.persistSavedInvoices();
                    window.showToast(`Beleg ${rec.invNo} gelöscht & Nummern angepasst.`, 'success');
                }
            );
        };

        window.setInvoiceArchiveFilter = function(fKey) {
            window.invoiceArchiveFilter = fKey || 'all';
            document.querySelectorAll('#invArchiveFilterPills .admin-filter-pill').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-inv-filter') === window.invoiceArchiveFilter);
            });
            window.renderSavedInvoicesArchive();
        };

        window.renderSavedInvoicesArchive = function() {
            const listEl = document.getElementById('invArchiveList');
            const filterBar = document.getElementById('invClientFilterBar');
            const filterNameEl = document.getElementById('invClientFilterName');

            const allRaw = window.savedInvoicesData || [];
            window.updateInvoiceCountBadges();

            let baseList = allRaw;
            if (window.invoiceCustomerFilter) {
                baseList = window.getInvoicesForCustomer(window.invoiceCustomerFilter);
                if (filterBar) filterBar.style.display = 'flex';
                if (filterNameEl) filterNameEl.innerText = window.invoiceCustomerFilter.name;
            } else {
                if (filterBar) filterBar.style.display = 'none';
            }

            let paidSum = 0, openSum = 0;
            baseList.forEach(x => {
                const t = Number(x.total) || 0;
                if (x.payStatus === 'paid') paidSum += t;
                else openSum += t;
            });
            if (document.getElementById('invStatCount')) document.getElementById('invStatCount').innerText = String(baseList.length);
            if (document.getElementById('invStatPaidSum')) document.getElementById('invStatPaidSum').innerText = window.formatEuroDE(paidSum);
            if (document.getElementById('invStatOpenSum')) document.getElementById('invStatOpenSum').innerText = window.formatEuroDE(openSum);

            if (!listEl) return;
            const q = (document.getElementById('invArchiveSearch')?.value || '').trim().toLowerCase();
            const f = window.invoiceArchiveFilter || 'all';

            const filtered = baseList.filter(rec => {
                const statusMatch = (f === 'all') || (rec.payStatus === f);
                const hay = `${rec.invNo || ''} ${rec.docTitle || ''} ${rec.custName || ''} ${rec.plate || ''} ${rec.invDate || ''} ${(rec.items || []).map(i => i.desc).join(' ')}`.toLowerCase();
                return statusMatch && (!q || hay.includes(q));
            });

            if (filtered.length === 0) {
                listEl.innerHTML = `<div style="text-align:center; padding:26px 14px; color:var(--text-muted); font-size:12px; background:var(--bg-input); border-radius:12px;">
                    <i class="fa-solid fa-receipt" style="font-size:24px; opacity:0.5; display:block; margin-bottom:8px;"></i>
                    Noch keine passenden Belege, Rechnungen oder Angebote gespeichert.
                </div>`;
                return;
            }

            listEl.innerHTML = filtered.map(rec => {
                const isPaid = rec.payStatus === 'paid';
                const isQuote = rec.payStatus === 'quote' || window.getDocTemplateMeta(rec.docTitle).isQuote;
                const statusPill = isPaid
                    ? `<span style="background:var(--green-bg-soft); color:var(--green-accent); font-size:9.5px; font-weight:900; padding:2px 8px; border-radius:6px;">✅ BAR BEZAHLT</span>`
                    : (isQuote
                        ? `<span style="background:rgba(0,122,255,0.13); color:#0066d6; font-size:9.5px; font-weight:900; padding:2px 8px; border-radius:6px;">📋 ANGEBOT / KV</span>`
                        : `<span style="background:rgba(245,158,11,0.16); color:#d97706; font-size:9.5px; font-weight:900; padding:2px 8px; border-radius:6px;">⏳ OFFEN</span>`);
                const itemsPreview = (rec.items || []).map(i => `${i.qty}× ${i.desc}`).join(' • ');
                const metaLabel = window.getDocTemplateMeta(rec.docTitle).label;

                return `
                    <div class="inv-archive-card ${isPaid ? '' : 'is-open'}">
                        <div class="inv-arch-top">
                            <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                                <span style="font-family:'Courier New', monospace; font-weight:900; font-size:11.5px; color:var(--primary-red); background:var(--bg-card); border:1px solid var(--glass-border); padding:2px 7px; border-radius:6px;">${window.escHtml(rec.invNo)}</span>
                                <span class="inv-doc-type-pill">${window.escHtml(metaLabel)}</span>
                                <span style="font-size:10.5px; color:var(--text-muted); font-weight:700;">${window.escHtml(rec.invDate)}</span>
                            </div>
                            ${statusPill}
                        </div>
                        <div class="inv-arch-mid">
                            <div style="min-width:0; flex:1;">
                                <strong style="font-size:13.5px; color:var(--text-light); display:block;">${window.escHtml(rec.custName)}</strong>
                                ${rec.plate ? `<span style="font-size:10.5px; font-weight:800; color:#007aff; display:inline-block; margin-top:2px;"><i class="fa-solid fa-id-card"></i> ${window.escHtml(rec.plate)}</span>` : ''}
                                <div style="font-size:11px; color:var(--text-muted); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escHtml(itemsPreview)}</div>
                            </div>
                            <strong style="font-size:16px; font-weight:900; color:${isPaid ? 'var(--green-accent)' : '#d97706'}; white-space:nowrap;">${window.formatEuroDE(rec.total)}</strong>
                        </div>
                        <div class="inv-arch-actions">
                            <button type="button" class="inv-arch-btn edit" onclick="window.editSavedInvoice('${rec.id}')"><i class="fa-solid fa-pen"></i> Bearbeiten</button>
                            <button type="button" class="inv-arch-btn pdf" onclick="window.printSavedInvoiceById('${rec.id}')"><i class="fa-solid fa-file-pdf"></i> PDF / Druck</button>
                            <button type="button" class="inv-arch-btn" onclick="window.toggleSavedInvoicePaid('${rec.id}')" title="${isPaid ? 'Auf Offen setzen' : 'Als Bezahlt markieren'}"><i class="fa-solid ${isPaid ? 'fa-rotate-left' : 'fa-check'}" style="color:${isPaid ? '#d97706' : 'var(--green-accent)'};"></i></button>
                            <button type="button" class="inv-arch-btn del" onclick="window.deleteSavedInvoice('${rec.id}')" title="Beleg löschen"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        window.renderCashInvoicePdfWindow = function(rec) {
            const esc = window.escHtml;
            const phone = esc(window.dynamicContactData?.phone || '0178 378 38 75');
            const email = esc(window.dynamicContactData?.email || 'Redzulassungsdienst@gmail.com');
            const rawUstid = (window.dynamicContactData?.ustid || '').trim();
            const hasUstid = rawUstid !== '' && !rawUstid.toLowerCase().includes('hier steuernummer');

            const items = rec.items || [];
            const subTotal = items.reduce((s, i) => s + (Number(i.lineTotal) || 0), 0);
            const discount = Number(rec.discount) || 0;
            const total = Math.max(0, subTotal - discount);
            const isQuote = rec.payStatus === 'quote' || window.getDocTemplateMeta(rec.docTitle).isQuote;
            const isProtocol = rec.docTitle === 'ÜBERGABEPROTOKOLL';

            const rowsHtml = items.map((it, idx) => `
                <tr>
                    <td class="col-pos">${idx + 1}</td>
                    <td><strong>${esc(it.desc || 'Zulassungs- / Schilderservice')}</strong></td>
                    <td class="col-qty">${it.qty || 1}</td>
                    <td class="col-price">${window.formatEuroDE(it.unitPrice)}</td>
                    <td class="col-total">${window.formatEuroDE(it.lineTotal)}</td>
                </tr>
            `).join('');

            const discountRow = discount > 0 ? `<tr><td style="color:#0b6e31;">Abzgl. Nachlass / Rabatt:</td><td style="color:#0b6e31;">− ${window.formatEuroDE(discount)}</td></tr>` : '';
            let totalsHtml = '', taxLegalNote = '';
            if (rec.taxMode === 'mwst19') {
                const netto = total / 1.19;
                const mwst = total - netto;
                totalsHtml = `
                    ${discountRow}
                    <tr><td>Nettobetrag:</td><td>${window.formatEuroDE(netto)}</td></tr>
                    <tr><td>zzgl. 19 % Umsatzsteuer:</td><td>${window.formatEuroDE(mwst)}</td></tr>
                    <tr class="grand-total"><td>Gesamtbetrag (Brutto):</td><td>${window.formatEuroDE(total)}</td></tr>
                `;
            } else if (rec.taxMode === 'klein') {
                totalsHtml = `${discountRow}<tr class="grand-total"><td>Gesamtbetrag:</td><td>${window.formatEuroDE(total)}</td></tr>`;
                taxLegalNote = '<p class="legal-note">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>';
            } else {
                totalsHtml = `${discountRow}<tr class="grand-total"><td>Gesamtbetrag (Komplettpreis):</td><td>${window.formatEuroDE(total)}</td></tr>`;
                taxLegalNote = '<p class="legal-note">Komplettbetrag inkl. Serviceleistung (inkl. gesetzl. MwSt.) sowie im Namen und für Rechnung des Kunden verauslagter amtlicher Behördengebühren (durchlaufende Posten gem. § 10 Abs. 1 Satz 5 UStG).</p>';
            }

            if (rec.docTitle === 'KOSTENVORANSCHLAG') {
                taxLegalNote += '<p class="legal-note"><strong>Hinweis zum Kostenvoranschlag:</strong> Unverbindliche Kostenschätzung auf Basis Ihrer Angaben. Eventuelle Zusatzgebühren der Zulassungsbehörde (LABO Berlin) werden gesondert abgestimmt.</p>';
            } else if (rec.docTitle === 'ANGEBOT') {
                taxLegalNote += `<p class="legal-note"><strong>Angebotsbedingungen:</strong> Dieses Angebot ist freibleibend${rec.validUntil ? ' und gültig bis zum ' + esc(rec.validUntil) : ''}. Zahlung in Bar bei Abgabe oder Abholung der Unterlagen.</p>`;
            }

            const protocolChecklistHtml = isProtocol ? `
                <div class="protocol-box">
                    <strong class="protocol-title">Übergebene Dokumente &amp; Kennzeichen (bitte ankreuzen):</strong>
                    <div class="protocol-grid">
                        <div>[ &nbsp; ] Zulassungsbescheinigung Teil I (Schein)</div>
                        <div>[ &nbsp; ] Zulassungsbescheinigung Teil II (Brief)</div>
                        <div>[ &nbsp; ] Personalausweis / Reisepass (Original)</div>
                        <div>[ &nbsp; ] HU / TÜV-Bericht &amp; eVB-Nummer</div>
                        <div>[ &nbsp; ] Vollmacht &amp; SEPA-Lastschriftmandat</div>
                        <div>[ &nbsp; ] Kennzeichenschilder (Anz.: _____) / Plakette</div>
                    </div>
                </div>
            ` : '';

            const payBoxHtml = isQuote
                ? `<div class="pay-badge quote">UNVERBINDLICHES DOKUMENT (${esc(rec.docTitle)})${rec.validUntil ? ' • GÜLTIG BIS ' + esc(rec.validUntil) : ''}</div>`
                : (rec.payStatus === 'paid'
                    ? `<div class="pay-badge paid">✓ BETRAG VON ${window.formatEuroDE(total)} DANKEND IN BAR ERHALTEN (${esc(rec.invDate)})</div>`
                    : `<div class="pay-badge open">ZAHLUNGSART: BARZAHLUNG BEI ÜBERGABE / ABHOLUNG</div>`);

            const brandImgSrc = typeof window.getAbsoluteBrandLogoUrl === 'function' ? window.getAbsoluteBrandLogoUrl() : './red-logo-round.jpg';
            const logoStyle = rec.logoStyle || (rec.showLogo === false ? 'none' : 'round_text');
            const stampStyle = rec.stampStyle || (rec.showStamp === false ? 'none' : 'classic');

            let logoHtml = `<div class="brand-plain">RED Zulassungsdienst Berlin</div>`;
            if (logoStyle === 'round_text') {
                logoHtml = `
                    <div class="brand-combo">
                        <img src="${esc(brandImgSrc)}" alt="RED Logo" class="brand-round-img" onerror="this.style.display='none'">
                        <div class="brand-logo">
                            <div class="brand-red">RED</div>
                            <div class="brand-sub">ZULASSUNGSDIENST &amp; SCHILDER BERLIN</div>
                        </div>
                    </div>
                `;
            } else if (logoStyle === 'round') {
                logoHtml = `<img src="${esc(brandImgSrc)}" alt="RED Logo" class="brand-round-img large" onerror="this.style.display='none'">`;
            } else if (logoStyle === 'text') {
                logoHtml = `
                    <div class="brand-logo">
                        <div class="brand-red">RED</div>
                        <div class="brand-sub">ZULASSUNGSDIENST &amp; SCHILDER BERLIN</div>
                    </div>
                `;
            }

            const stampBottomText = isQuote ? '★ ANGEBOT / INFO ★' : (rec.payStatus === 'paid' ? '★ BAR BEZAHLT ★' : '★ BERLIN-NEUKÖLLN ★');
            const classicStamp = `
                <div class="rubber-stamp">
                    <div class="stamp-top">RED ZULASSUNGSDIENST</div>
                    <div class="stamp-mid">Inh. Tamer Yazici • Kienitzer Str. 6<br>12053 Berlin • Tel. ${phone}</div>
                    <div class="stamp-bot">${stampBottomText}</div>
                </div>
            `;
            const roundSealStamp = `
                <div class="round-logo-stamp">
                    <img src="${esc(brandImgSrc)}" alt="RED Siegel" onerror="this.style.display='none'">
                    <span>${stampBottomText}</span>
                </div>
            `;
            let stampHtml = '';
            if (stampStyle === 'classic') stampHtml = classicStamp;
            else if (stampStyle === 'round_logo') stampHtml = roundSealStamp;
            else if (stampStyle === 'both') stampHtml = `<div class="dual-stamp-wrap">${roundSealStamp}${classicStamp}</div>`;

            const sigSectionHtml = rec.showSigLines !== false ? `
                <div class="sig-area">
                    <div class="sig-col">
                        <div class="sig-pad-line">${rec.sigDataUrl ? `<img src="${rec.sigDataUrl}" alt="Unterschrift">` : ''}</div>
                        <small>Berlin, den ${esc(rec.invDate)} – <strong>Unterschrift Kunde (${isQuote ? 'Auftrag erteilt' : 'Beleg / Unterlagen erhalten'})</strong></small>
                    </div>
                    <div class="sig-col" style="position:relative;">
                        ${stampHtml}
                        <div class="sig-pad-line"></div>
                        <small>Berlin, den ${esc(rec.invDate)} – <strong>Stempel &amp; Unterschrift RED Zulassungsdienst</strong></small>
                    </div>
                </div>
            ` : (rec.showStamp !== false ? `<div class="stamp-standalone-wrap">${stampHtml}</div>` : '');

            const printWin = window.open('', '_blank');
            if (!printWin) {
                window.showToast('Bitte Pop-ups erlauben, um das PDF zu öffnen.', 'error');
                return;
            }
            printWin.document.write(`
                <!DOCTYPE html>
                <html lang="de">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
                    <title>${esc(rec.docTitle)} ${esc(rec.invNo)} - RED Zulassungsdienst Berlin</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm 12mm; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        html, body { margin: 0; padding: 0; width: 100%; background: #1e2028; font-family: Arial, Helvetica, sans-serif; color: #141417; -webkit-text-size-adjust: 100%; }

                        /* Feste RED PDF-Viewer Steuerleiste oben */
                        .viewer-toolbar {
                            position: sticky; top: 0; z-index: 100;
                            background: #0e0e14; color: #ffffff;
                            border-bottom: 2.5px solid #d90000;
                            padding: 10px 14px;
                            display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
                            box-shadow: 0 6px 22px rgba(0,0,0,0.4);
                        }
                        .vt-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
                        .vt-info strong { font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .vt-info span { font-size: 10.5px; color: #a8a8b8; }
                        .vt-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
                        .vt-btn {
                            border: none; border-radius: 9px; padding: 10px 15px;
                            font-size: 12px; font-weight: 800; cursor: pointer;
                            display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
                        }
                        .vt-btn-pdf { background: #d90000; color: #fff; }
                        .vt-btn-close { background: #262632; color: #fff; border: 1px solid rgba(255,255,255,0.2); }

                        /* Echtes DIN-A4 Blatt im Viewer */
                        .sheet-wrap { padding: 20px 14px 34px; display: flex; justify-content: center; }
                        .page {
                            width: 210mm; max-width: 100%; min-height: 297mm;
                            background: #ffffff;
                            border-radius: 6px;
                            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
                            padding: 15mm 15mm 13mm;
                            display: flex; flex-direction: column;
                            font-size: 12.5px; line-height: 1.5;
                        }
                        .page-body { flex: 1 1 auto; }

                        .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #d90000; padding-bottom: 14px; margin-bottom: 18px; gap: 16px; }
                        .brand-red { font-size: 32px; font-weight: 900; color: #d90000; letter-spacing: 3px; line-height: 1; }
                        .brand-sub { font-size: 10px; font-weight: 800; letter-spacing: 1.1px; color: #141417; margin-top: 3px; }
                        .brand-plain { font-size: 20px; font-weight: 900; color: #141417; }
                        .brand-combo { display: flex; align-items: center; gap: 12px; }
                        .brand-round-img { width: 58px; height: 58px; border-radius: 50%; object-fit: cover; object-position: center; border: 2px solid #d90000; background: #000; flex-shrink: 0; }
                        .brand-round-img.large { width: 74px; height: 74px; }
                        .round-logo-stamp {
                            position: absolute; right: 10px; bottom: 22px; transform: rotate(-6deg);
                            display: inline-flex; flex-direction: column; align-items: center; gap: 3px;
                            padding: 5px 8px; border: 2px solid #d90000; border-radius: 10px;
                            background: rgba(255, 255, 255, 0.92);
                        }
                        .round-logo-stamp img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; object-position: center; background: #000; }
                        .round-logo-stamp span { font-size: 8px; font-weight: 900; color: #d90000; letter-spacing: 0.4px; }
                        .dual-stamp-wrap { position: absolute; right: 6px; bottom: 22px; display: inline-flex; align-items: center; gap: 8px; }
                        .dual-stamp-wrap .rubber-stamp, .dual-stamp-wrap .round-logo-stamp { position: relative !important; right: auto !important; bottom: auto !important; }
                        .stamp-standalone-wrap .round-logo-stamp, .stamp-standalone-wrap .dual-stamp-wrap { position: relative !important; right: auto !important; bottom: auto !important; }
                        .sender-info { text-align: right; font-size: 11px; color: #444; line-height: 1.45; }

                        .meta-grid { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
                        .recipient-box { flex: 1.25; background: #f8f8fa; border: 1px solid #ddd; border-radius: 8px; padding: 12px 14px; }
                        .recipient-box .mini-sender { font-size: 9px; color: #666; text-decoration: underline; margin-bottom: 6px; }
                        .invoice-meta { flex: 0.9; background: #f8f8fa; border: 1px solid #ddd; border-left: 4px solid #d90000; border-radius: 8px; padding: 12px 14px; font-size: 11.5px; }
                        .invoice-meta div { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; }

                        h1 { font-size: 19px; margin: 0 0 12px; color: #141417; letter-spacing: 0.5px; text-transform: uppercase; }
                        .protocol-box { border: 1.5px solid #222; border-radius: 8px; padding: 10px 14px; margin: 12px 0 14px; background: #fafafa; font-size: 11.5px; }
                        .protocol-title { display: block; color: #d90000; text-transform: uppercase; font-size: 10.5px; margin-bottom: 6px; }
                        .protocol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; }

                        table.items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
                        table.items th { background: #14141c; color: #fff; padding: 9px 9px; font-size: 10.5px; text-transform: uppercase; text-align: left; }
                        table.items td { padding: 9px 9px; border-bottom: 1px solid #ddd; vertical-align: top; }
                        .col-pos, .col-qty { text-align: center; white-space: nowrap; }
                        .col-price, .col-total { text-align: right; white-space: nowrap; }
                        .col-total { font-weight: 700; }

                        table.totals { width: 320px; max-width: 100%; margin-left: auto; border-collapse: collapse; font-size: 12.5px; }
                        table.totals td { padding: 5px 8px; }
                        table.totals td:last-child { text-align: right; font-weight: 700; white-space: nowrap; }
                        table.totals tr.grand-total td { border-top: 2px solid #141417; font-size: 15px; font-weight: 900; color: #d90000; padding-top: 8px; }

                        .pay-badge { margin-top: 16px; padding: 10px 14px; border-radius: 8px; font-weight: 900; font-size: 12px; text-align: center; letter-spacing: 0.3px; }
                        .pay-badge.paid { background: #eafaf0; border: 1.5px solid #16a34a; color: #0b6e31; }
                        .pay-badge.open { background: #fff7ed; border: 1.5px solid #d97706; color: #9a3412; }
                        .pay-badge.quote { background: #eff6ff; border: 1.5px solid #007aff; color: #0050b3; }
                        .legal-note { font-size: 10.5px; color: #555; margin: 8px 0 0; }
                        .extra-note { margin-top: 10px; padding: 8px 12px; background: #fafafa; border-left: 3px solid #888; font-size: 11.5px; }

                        .sig-area { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 44px; align-items: end; }
                        .sig-pad-line { border-bottom: 1.5px solid #111; min-height: 60px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; }
                        .sig-pad-line img { max-height: 56px; max-width: 100%; }
                        .sig-col small { display: block; margin-top: 5px; font-size: 10px; color: #333; line-height: 1.35; }
                        .rubber-stamp {
                            position: absolute; right: 6px; bottom: 26px; transform: rotate(-7deg);
                            border: 2.5px double #003a99; color: #003a99; border-radius: 6px;
                            padding: 5px 9px; text-align: center; background: rgba(255,255,255,0.9);
                            opacity: 0.9; pointer-events: none; line-height: 1.25;
                        }
                        .stamp-standalone-wrap {
                            display: flex; justify-content: flex-end; align-items: center;
                            margin: 22px 0 6px; padding-right: 4px;
                        }
                        .stamp-standalone-wrap .rubber-stamp {
                            position: relative !important; right: auto !important; bottom: auto !important;
                            display: inline-block; transform: rotate(-5deg);
                        }
                        .stamp-top { font-size: 10px; font-weight: 900; letter-spacing: 0.7px; }
                        .stamp-mid { font-size: 8px; font-weight: 700; margin: 2px 0; }
                        .stamp-bot { font-size: 8.5px; font-weight: 900; color: #d90000; border-top: 1px solid #003a99; padding-top: 2px; }

                        .doc-footer {
                            margin-top: auto; padding-top: 14px;
                            border-top: 1px solid #ccc; font-size: 10px; color: #666;
                            display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;
                        }

                        /* MOBIL-VORSCHAU: VOLLBREITES, SCHARF LESBARES DIN-A4 BLATT STATT MINI-ANSICHT */
                        @media screen and (max-width: 820px) {
                            .viewer-toolbar { padding: 9px 10px; }
                            .vt-info span { display: none; }
                            .vt-actions { width: 100%; }
                            .vt-btn-pdf { flex: 1; justify-content: center; padding: 10px 10px; font-size: 12px; }
                            .sheet-wrap { padding: 10px 8px 24px; }
                            .page {
                                width: 100%; min-height: 138vw;
                                padding: 16px 13px 14px;
                                border-radius: 10px;
                                font-size: 12px;
                            }
                            .header-row { flex-direction: column; gap: 8px; padding-bottom: 10px; margin-bottom: 14px; }
                            .brand-red { font-size: 26px; }
                            .sender-info { text-align: left; font-size: 10.5px; }
                            .meta-grid { flex-direction: column; gap: 10px; margin-bottom: 16px; }
                            h1 { font-size: 16px; }
                            .protocol-grid { grid-template-columns: 1fr; }
                            table.items th, table.items td { padding: 7px 5px; font-size: 11px; }
                            .col-pos { display: none; }
                            table.totals { width: 100%; font-size: 12px; }
                            .sig-area { grid-template-columns: 1fr; gap: 36px; margin-top: 32px; }
                            .sig-col .rubber-stamp { right: 4px; bottom: 34px; }
                            .stamp-standalone-wrap { justify-content: center; margin: 18px 0 4px; }
                            .doc-footer { margin-top: 28px; font-size: 9.5px; }
                        }

                        /* ECHTER DIN-A4 DRUCK & PDF-SPEICHERN (IMMER EXAKTES DIN A4 AUF HANDY & PC) */
                        @media print {
                            html, body { background: #ffffff !important; }
                            .viewer-toolbar { display: none !important; }
                            .sheet-wrap { padding: 0 !important; display: block !important; }
                            .page {
                                width: 100% !important; max-width: none !important; min-height: 274mm !important;
                                margin: 0 !important; padding: 2mm 1mm !important;
                                box-shadow: none !important; border-radius: 0 !important;
                                font-size: 12px !important;
                            }
                            .header-row { flex-direction: row !important; }
                            .sender-info { text-align: right !important; }
                            .meta-grid { flex-direction: row !important; }
                            .col-pos { display: table-cell !important; }
                            table.totals { width: 310px !important; }
                            .sig-area { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
                            .protocol-grid { grid-template-columns: 1fr 1fr !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="viewer-toolbar">
                        <div class="vt-info">
                            <strong>RED DIN-A4 Beleg ${esc(rec.invNo)}</strong>
                            <span>${esc(rec.docTitle)} • ${esc(rec.custName)}</span>
                        </div>
                        <div class="vt-actions">
                            <button type="button" class="vt-btn vt-btn-pdf" onclick="window.print()">🖨️ Als PDF speichern / Drucken</button>
                            <button type="button" class="vt-btn vt-btn-close" onclick="window.close()">✕</button>
                        </div>
                    </div>

                    <div class="sheet-wrap">
                        <div class="page">
                            <div class="page-body">
                                <div class="header-row">
                                    ${logoHtml}
                                    <div class="sender-info">
                                        <strong>RED Zulassungsdienst Berlin</strong><br>
                                        Inhaber: Tamer Yazici<br>
                                        Kienitzer Str. 6 • 12053 Berlin<br>
                                        Tel.: ${phone} • ${email}
                                        ${hasUstid ? `<br>USt-IdNr. / St.-Nr.: ${esc(rawUstid)}` : ''}
                                    </div>
                                </div>
                                <div class="meta-grid">
                                    <div class="recipient-box">
                                        <div class="mini-sender">RED Zulassungsdienst Berlin • Kienitzer Str. 6 • 12053 Berlin</div>
                                        <strong style="font-size:14px;">${esc(rec.custName)}</strong><br>
                                        ${rec.custAddr ? `${esc(rec.custAddr)}<br>` : ''}
                                        ${rec.custPhone ? `<span style="font-size:11px; color:#555;">Tel.: ${esc(rec.custPhone)}</span><br>` : ''}
                                        ${rec.plate ? `<span style="display:inline-block; margin-top:4px; font-size:11.5px; color:#333;"><strong>Kennzeichen:</strong> ${esc(rec.plate)}</span>` : ''}
                                        ${rec.vin ? `<span style="display:inline-block; margin-top:4px; margin-left:8px; font-size:11px; color:#555;"><strong>FIN:</strong> ${esc(rec.vin)}</span>` : ''}
                                    </div>
                                    <div class="invoice-meta">
                                        <div><span>Beleg-Nr.:</span><strong>${esc(rec.invNo)}</strong></div>
                                        <div><span>Datum:</span><strong>${esc(rec.invDate)}</strong></div>
                                        ${rec.validUntil && isQuote ? `<div><span>Gültig bis:</span><strong>${esc(rec.validUntil)}</strong></div>` : `<div><span>Leistungsdatum:</span><strong>${esc(rec.invDate)}</strong></div>`}
                                        ${rec.clientId ? `<div><span>Kunden-ID:</span><strong>${esc(rec.clientId)}</strong></div>` : ''}
                                        <div><span>Zahlungsart:</span><strong>Barzahlung</strong></div>
                                    </div>
                                </div>
                                <h1>${esc(rec.docTitle)}</h1>
                                ${protocolChecklistHtml}
                                <table class="items">
                                    <thead>
                                        <tr>
                                            <th class="col-pos" style="width:40px;">Pos.</th>
                                            <th>Beschreibung / Leistung</th>
                                            <th class="col-qty" style="width:55px;">Menge</th>
                                            <th class="col-price" style="width:95px;">Einzelpreis</th>
                                            <th class="col-total" style="width:100px;">Gesamt</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rowsHtml}</tbody>
                                </table>
                                <table class="totals"><tbody>${totalsHtml}</tbody></table>
                                ${taxLegalNote}
                                ${rec.note ? `<div class="extra-note"><strong>Hinweis:</strong> ${esc(rec.note)}</div>` : ''}
                                ${payBoxHtml}
                                ${sigSectionHtml}
                            </div>
                            <div class="doc-footer">
                                <span>RED Zulassungsdienst Berlin • Inh. Tamer Yazici • Kienitzer Str. 6, 12053 Berlin</span>
                                <span>Mo–Fr 09:00–20:00 Uhr • Tel.: ${phone}</span>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `);
            printWin.document.close();
        };

        window.printCashInvoice = function() {
            window.saveCurrentCashInvoice(true);
        };

        // =========================================================================
        // GESCHÄFTS-SHOWROOM GALERIE (KIENITZER STR. 6 – MIT ADMIN STYLING & UPLOAD)
        // =========================================================================
        const DEFAULT_SHOP_PHOTOS = [
            {
                id: 'shop-1',
                title: 'Annahmestelle Kienitzer\u00A0Str.\u00A06',
                subtitle: '12053\u00A0Berlin • U7\u00A0Karl-Marx-Str. & U8\u00A0Boddinstraße',
                badge: 'Standort',
                url: './laden-aussen.jpg',
                font: "'Montserrat', sans-serif",
                sizeDesktop: '12.5px',
                sizeMobile: '10.5px',
                subSizeMobile: '9.4px',
                cardColor: '',
                lightboxColor: '#d90000'
            },
            {
                id: 'shop-2',
                title: 'Eigene Schilderpresse vor\u00A0Ort',
                subtitle: 'Standard-Alu & 3D-Carbon sofort zum Mitnehmen',
                badge: 'Prägung',
                url: './schilderpresse.jpg',
                font: "'Montserrat', sans-serif",
                sizeDesktop: '12.5px',
                sizeMobile: '10.5px',
                subSizeMobile: '9.4px',
                cardColor: '',
                lightboxColor: '#d90000'
            },
            {
                id: 'shop-3',
                title: 'Präzisions-Heißprägung',
                subtitle: 'Fertige Kennzeichen in nur 3–5\u00A0Minuten',
                badge: 'Sofort-Service',
                url: './heisspraege.jpg',
                font: "'Montserrat', sans-serif",
                sizeDesktop: '12.5px',
                sizeMobile: '10.5px',
                subSizeMobile: '9.4px',
                cardColor: '',
                lightboxColor: '#d90000'
            },
            {
                id: 'shop-4',
                title: 'Modernes Büro & Empfang',
                subtitle: 'Schnelle 5-Minuten-Abgabe ohne Wartezeit',
                badge: 'Büro & Empfang',
                url: './laden-innen.jpg',
                font: "'Montserrat', sans-serif",
                sizeDesktop: '12.5px',
                sizeMobile: '10.5px',
                subSizeMobile: '9.4px',
                cardColor: '',
                lightboxColor: '#d90000'
            }
        ];

        window.formatShopCaptionText = function(txt) {
            return String(txt || '')
                .replace(/Kienitzer\s+Str\.\s*6/gi, 'Kienitzer\u00A0Str.\u00A06')
                .replace(/12053\s+Berlin/gi, '12053\u00A0Berlin')
                .replace(/Str\.\s*(\d+)/gi, 'Str.\u00A0$1')
                .replace(/vor\s+Ort/gi, 'vor\u00A0Ort')
                .replace(/U7\s+(Karl-Marx-Straße|Karl-Marx-Str\.)/gi, 'U7\u00A0$1')
                .replace(/U8\s+Boddinstraße/gi, 'U8\u00A0Boddinstraße')
                .replace(/(\d[\d–-]*)\s+(Minuten?|Min\.)/gi, '$1\u00A0$2');
        };

        window.shopPhotosData = JSON.parse(localStorage.getItem('red_shop_gallery_v1') || 'null') || DEFAULT_SHOP_PHOTOS.map(p => ({ ...p }));

        window.persistShopPhotos = async function() {
            localStorage.setItem('red_shop_gallery_v1', JSON.stringify(window.shopPhotosData));
            window.renderShopGallery();
            if (window.firebaseDb && window.firebaseSetDoc) {
                try {
                    await window.firebaseSetDoc(
                        window.firebaseDoc(window.firebaseDb, "settings", "shop_gallery"),
                        { list: window.shopPhotosData, updatedAt: Date.now() },
                        { merge: true }
                    );
                } catch (e) {
                    console.error('Shop-Galerie Sync Fehler:', e);
                }
            }
        };

        window.handleShopImgError = function(imgEl, photoId) {
            const card = imgEl.closest('.shop-photo-card');
            const isAdmin = document.body.classList.contains('is-supervisor') ||
                (document.body.classList.contains('is-admin') && document.body.classList.contains('perm-shopgallery'));
            if (!isAdmin) {
                if (card) card.style.display = 'none';
                const visibleCards = document.querySelectorAll('#shopGalleryGrid .shop-photo-card:not([style*="display: none"])').length;
                const wrap = document.getElementById('realShopGalleryWrap');
                if (wrap && visibleCards === 0) wrap.style.display = 'none';
            } else {
                const mediaBox = imgEl.parentElement;
                imgEl.remove();
                if (mediaBox) {
                    const ph = document.createElement('div');
                    ph.className = 'shop-photo-missing-box';
                    ph.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>Bild noch nicht hochgeladen.<br>Auf den grünen Stift tippen zum Hochladen!</span>`;
                    mediaBox.appendChild(ph);
                }
            }
        };

        window.renderShopGallery = function() {
            const grid = document.getElementById('shopGalleryGrid');
            const wrap = document.getElementById('realShopGalleryWrap');
            if (!grid || !wrap) return;

            const list = Array.isArray(window.shopPhotosData) ? window.shopPhotosData : [];
            // Automatische Aktualisierung des alten Untertitels auf PLZ + U7 Karl-Marx-Str. & U8 Boddinstraße
            let migratedShopText = false;
            list.forEach(p => {
                if (p && p.id === 'shop-1' && p.subtitle && !p.subtitle.toLowerCase().includes('karl-marx')) {
                    p.subtitle = '12053\u00A0Berlin • U7\u00A0Karl-Marx-Str. & U8\u00A0Boddinstraße';
                    migratedShopText = true;
                }
            });
            if (migratedShopText) {
                localStorage.setItem('red_shop_gallery_v1', JSON.stringify(list));
                if (window.isAuthorized && window.firebaseDb && window.firebaseSetDoc) {
                    window.firebaseSetDoc(window.firebaseDoc(window.firebaseDb, "settings", "shop_gallery"), { list, updatedAt: Date.now() }, { merge: true }).catch(() => {});
                }
            }
            const isAdmin = document.body.classList.contains('is-supervisor') ||
                (document.body.classList.contains('is-admin') && document.body.classList.contains('perm-shopgallery'));

            if (list.length === 0 && !isAdmin) {
                wrap.style.display = 'none';
                return;
            }
            wrap.style.display = 'block';
            grid.innerHTML = '';

            if (list.length === 0 && isAdmin) {
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:22px; background:var(--bg-input); border-radius:12px; font-size:12px; color:var(--text-muted);">Keine Geschäftsfotos aktiv – über „+ Foto hinzufügen“ oder „Standard“ sofort wieder befüllen.</div>`;
                return;
            }

            list.forEach(photo => {
                const cleanTitle = window.formatShopCaptionText(photo.title || 'RED Berlin');
                const cleanSub = window.formatShopCaptionText(photo.subtitle || '');
                const card = document.createElement('figure');
                card.className = 'shop-photo-card';
                card.onclick = () => window.openLightbox(cleanTitle, photo.url || '', {
                    subtitle: cleanSub,
                    badge: photo.badge || 'RED Berlin Galerie',
                    font: photo.font || "'Montserrat', sans-serif",
                    lightboxColor: photo.lightboxColor || '#d90000'
                });

                const styleVars = [
                    `--sp-font:${photo.font || "'Montserrat', sans-serif"}`,
                    `--sp-size-d:${photo.sizeDesktop || '12.5px'}`,
                    `--sp-size-m:${photo.sizeMobile || '10.5px'}`,
                    `--sp-sub-m:${photo.subSizeMobile || '9.4px'}`,
                    photo.cardColor ? `--sp-title-col:${photo.cardColor}` : ''
                ].filter(Boolean).join(';');

                card.innerHTML = `
                    <div class="shop-photo-media">
                        ${photo.badge ? `<span class="shop-photo-badge">${window.escHtml(photo.badge)}</span>` : ''}
                        <div class="shop-photo-admin-btns action-shopgallery">
                            <button type="button" class="mini-admin-btn edit" onclick="event.stopPropagation(); window.openShopPhotoModal('${photo.id}')" title="Foto, Etikett & Schrift bearbeiten"><i class="fa-solid fa-pencil"></i></button>
                            <button type="button" class="mini-admin-btn del" onclick="event.stopPropagation(); window.deleteShopPhoto('${photo.id}')" title="Foto entfernen"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <img src="${window.escHtml(photo.url)}" alt="${window.escHtml(cleanTitle)}" loading="lazy" decoding="async" onerror="window.handleShopImgError(this, '${photo.id}')">
                        <span class="shop-photo-zoom" aria-hidden="true"><i class="fa-solid fa-magnifying-glass-plus"></i></span>
                    </div>
                    <figcaption class="shop-photo-caption" style="${styleVars}">
                        <strong>${window.escHtml(cleanTitle)}</strong>
                        ${cleanSub ? `<span>${window.escHtml(cleanSub)}</span>` : ''}
                    </figcaption>
                `;
                grid.appendChild(card);
            });
        };

        window.toggleShopCustomBadgeInput = function() {
            const sel = document.getElementById('shopPhotoBadge');
            const grp = document.getElementById('shopPhotoBadgeCustomGroup');
            if (!sel || !grp) return;
            grp.style.display = (sel.value === '__custom__') ? 'block' : 'none';
        };

        window.setShopModalPreview = function(src) {
            const box = document.getElementById('shopPhotoPreviewBox');
            if (!box) return;
            if (src) {
                box.innerHTML = `<img src="${window.escHtml(src)}" alt="Vorschau">`;
            } else {
                box.innerHTML = `<i class="fa-solid fa-image" style="font-size:28px; color:var(--text-muted);"></i><span>Noch kein Bild ausgewählt</span>`;
            }
        };

        window.previewShopPhotoUrl = function(val) {
            const clean = String(val || '').trim();
            if (clean) {
                document.getElementById('shopPhotoDataUrl').value = '';
                window.setShopModalPreview(clean);
            }
        };

        window.compressImageFileToDataUrl = function(file, maxEdge = 960, quality = 0.78) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Lesefehler'));
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onerror = () => reject(new Error('Bildfehler'));
                    img.onload = () => {
                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;
                        if (w > maxEdge || h > maxEdge) {
                            if (w >= h) { h = Math.round(h * (maxEdge / w)); w = maxEdge; }
                            else { w = Math.round(w * (maxEdge / h)); h = maxEdge; }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
        };

        window.handleShopPhotoFileSelect = async function(input) {
            const file = input.files && input.files[0];
            const lbl = document.getElementById('shopPhotoFileLabel');
            if (!file) return;
            if (lbl) lbl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Optimiere Foto...`;
            try {
                const compressed = await window.compressImageFileToDataUrl(file, 960, 0.78);
                document.getElementById('shopPhotoDataUrl').value = compressed;
                document.getElementById('shopPhotoUrlInput').value = '';
                window.setShopModalPreview(compressed);
                if (lbl) lbl.innerHTML = `<i class="fa-solid fa-check" style="color:#25D366;"></i> ${window.escHtml(file.name)} (Optimiert)`;
            } catch (err) {
                window.showToast('Foto konnte nicht verarbeitet werden.', 'error');
                if (lbl) lbl.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Foto auswählen (wird automatisch optimiert)`;
            }
        };

        window.openShopPhotoModal = function(photoId = '') {
            const isEdit = !!photoId;
            const item = isEdit ? (window.shopPhotosData || []).find(p => p.id === photoId) : null;

            document.getElementById('shopPhotoModalHeading').innerHTML = isEdit
                ? '<i class="fa-solid fa-pen"></i> Geschäftsfoto &amp; Schrift bearbeiten'
                : '<i class="fa-solid fa-plus"></i> Neues Geschäftsfoto hinzufügen';
            document.getElementById('shopPhotoEditId').value = item ? item.id : '';
            document.getElementById('shopPhotoTitle').value = item ? (item.title || '').replace(/\u00A0/g, ' ') : '';
            document.getElementById('shopPhotoSub').value = item ? (item.subtitle || '').replace(/\u00A0/g, ' ') : '';

            const badgeSel = document.getElementById('shopPhotoBadge');
            const badgeCustomInp = document.getElementById('shopPhotoBadgeCustom');
            const badgeVal = item ? (item.badge || '') : 'Standort';
            if (badgeSel) {
                const hasOpt = Array.from(badgeSel.options).some(o => o.value === badgeVal && o.value !== '__custom__');
                if (hasOpt) {
                    badgeSel.value = badgeVal;
                    if (badgeCustomInp) badgeCustomInp.value = '';
                } else {
                    badgeSel.value = '__custom__';
                    if (badgeCustomInp) badgeCustomInp.value = badgeVal;
                }
                window.toggleShopCustomBadgeInput();
            }

            if (document.getElementById('shopPhotoFont')) document.getElementById('shopPhotoFont').value = item?.font || "'Montserrat', sans-serif";
            if (document.getElementById('shopPhotoSizeDesktop')) document.getElementById('shopPhotoSizeDesktop').value = item?.sizeDesktop || '12.5px';
            if (document.getElementById('shopPhotoSizeMobile')) document.getElementById('shopPhotoSizeMobile').value = item?.sizeMobile || '10.5px';
            if (document.getElementById('shopPhotoSubSizeMobile')) document.getElementById('shopPhotoSubSizeMobile').value = item?.subSizeMobile || '9.4px';
            if (document.getElementById('shopPhotoCardColor')) document.getElementById('shopPhotoCardColor').value = item?.cardColor || '';
            if (document.getElementById('shopPhotoLightboxColor')) document.getElementById('shopPhotoLightboxColor').value = item?.lightboxColor || '#d90000';

            const existingUrl = item ? (item.url || '') : '';
            document.getElementById('shopPhotoDataUrl').value = existingUrl.startsWith('data:') ? existingUrl : '';
            document.getElementById('shopPhotoUrlInput').value = existingUrl.startsWith('data:') ? '' : existingUrl;
            document.getElementById('shopPhotoFileInput').value = '';
            document.getElementById('shopPhotoFileLabel').innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Foto auswählen (wird automatisch optimiert)`;
            window.setShopModalPreview(existingUrl);

            document.getElementById('shopPhotoEditOverlay').classList.add('open');
            setTimeout(() => {
                if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            }, 40);
        };

        window.closeShopPhotoModal = function() {
            document.getElementById('shopPhotoEditOverlay').classList.remove('open');
        };

        window.saveShopPhotoItem = async function() {
            const editId = document.getElementById('shopPhotoEditId').value;
            const title = window.formatShopCaptionText(document.getElementById('shopPhotoTitle').value.trim());
            const subtitle = window.formatShopCaptionText(document.getElementById('shopPhotoSub').value.trim());
            const selBadge = document.getElementById('shopPhotoBadge').value;
            const badge = selBadge === '__custom__'
                ? (document.getElementById('shopPhotoBadgeCustom')?.value.trim() || '')
                : selBadge;
            const font = document.getElementById('shopPhotoFont')?.value || "'Montserrat', sans-serif";
            const sizeDesktop = document.getElementById('shopPhotoSizeDesktop')?.value || '12.5px';
            const sizeMobile = document.getElementById('shopPhotoSizeMobile')?.value || '10.5px';
            const subSizeMobile = document.getElementById('shopPhotoSubSizeMobile')?.value || '9.4px';
            const cardColor = document.getElementById('shopPhotoCardColor')?.value || '';
            const lightboxColor = document.getElementById('shopPhotoLightboxColor')?.value || '#d90000';

            const dataUrl = document.getElementById('shopPhotoDataUrl').value.trim();
            const rawUrl = document.getElementById('shopPhotoUrlInput').value.trim();
            const finalUrl = dataUrl || rawUrl;

            if (!title) { window.showToast('Bitte eine Überschrift für das Foto eingeben.', 'error'); return; }
            if (!finalUrl) { window.showToast('Bitte ein Foto auswählen oder einen Bildpfad eintragen.', 'error'); return; }

            const record = { id: editId || ('shop-' + Date.now()), title, subtitle, badge, url: finalUrl, font, sizeDesktop, sizeMobile, subSizeMobile, cardColor, lightboxColor };
            if (editId) {
                const idx = window.shopPhotosData.findIndex(p => p.id === editId);
                if (idx > -1) window.shopPhotosData[idx] = record;
            } else {
                window.shopPhotosData.push(record);
            }

            await window.persistShopPhotos();
            window.closeShopPhotoModal();
            window.showToast(editId ? 'Geschäftsfoto & Styling aktualisiert!' : 'Neues Geschäftsfoto veröffentlicht!', 'success');
        };

        window.deleteShopPhoto = function(photoId) {
            const item = (window.shopPhotosData || []).find(p => p.id === photoId);
            if (!item) return;
            window.openRedDeleteConfirm(
                'Geschäftsfoto löschen?',
                `Möchten Sie „${item.title}“ wirklich aus der Geschäftsgalerie entfernen?`,
                async () => {
                    window.shopPhotosData = window.shopPhotosData.filter(p => p.id !== photoId);
                    await window.persistShopPhotos();
                    window.showToast('Foto entfernt.', 'success');
                }
            );
        };

        window.restoreDefaultShopPhotos = function() {
            window.openRedDeleteConfirm(
                'Standard-Fotos laden?',
                'Möchten Sie die 4 Standard-Geschäftsfotos (Kienitzer Str. 6) wiederherstellen?',
                async () => {
                    window.shopPhotosData = DEFAULT_SHOP_PHOTOS.map(p => ({ ...p }));
                    await window.persistShopPhotos();
                    window.showToast('Alle 4 Standard-Geschäftsfotos wiederhergestellt!', 'success');
                }
            );
        };

        document.addEventListener('DOMContentLoaded', () => {
            window.renderShopGallery();
        });

        // =========================================================================
        // PASSWORT-MANAGER PRO & SUPERVISOR BENUTZER-TAB HELFER
        // =========================================================================
        window.togglePasswordVis = function(inputId, btnEl) {
            const inp = document.getElementById(inputId);
            if (!inp) return;
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            if (btnEl) btnEl.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        };

        window.fillGeneratedPass = function(targetId, confirmId = '') {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
            let pw = 'Red!';
            for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
            const el = document.getElementById(targetId);
            if (el) { el.value = pw; el.type = 'text'; }
            if (confirmId) {
                const cel = document.getElementById(confirmId);
                if (cel) { cel.value = pw; cel.type = 'text'; }
            }
            window.updatePasswordStrength();
            window.showToast('Sicheres Passwort generiert – bitte notieren!', 'success');
        };

        window.copyPasswordInput = function(inputId) {
            const val = document.getElementById(inputId)?.value || '';
            if (!val) { window.showToast('Kein Passwort zum Kopieren eingegeben.', 'error'); return; }
            navigator.clipboard?.writeText(val).then(() => window.showToast('Passwort kopiert!', 'success')).catch(() => {});
        };

        window.updatePasswordStrength = function() {
            const pw = document.getElementById('newPassInput')?.value || '';
            const pw2 = document.getElementById('newPassConfirmInput')?.value || '';
            const fill = document.getElementById('pwStrengthFill');
            const lbl = document.getElementById('pwStrengthLabel');

            const hasLen = pw.length >= 6;
            const hasMix = /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);
            const matches = pw.length > 0 && pw === pw2;

            const markChk = (id, ok) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.toggle('ok', ok);
                const ic = el.querySelector('i');
                if (ic) ic.className = ok ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
            };
            markChk('pwChkLen', hasLen);
            markChk('pwChkStrong', hasMix);
            markChk('pwChkMatch', matches);

            if (!fill || !lbl) return;
            let score = 0;
            if (pw.length >= 6) score += 35;
            if (pw.length >= 10) score += 20;
            if (hasMix) score += 30;
            if (/[^A-Za-z0-9]/.test(pw)) score += 15;

            fill.style.width = pw ? Math.min(100, score) + '%' : '0%';
            if (!pw) { fill.style.background = '#ff3b30'; lbl.innerText = 'Bitte neues Passwort eingeben'; }
            else if (score < 50) { fill.style.background = '#ff3b30'; lbl.innerText = 'Schwach – bitte länger oder mit Zahlen wählen'; }
            else if (score < 80) { fill.style.background = '#f59e0b'; lbl.innerText = 'Mittel – gut nutzbar'; }
            else { fill.style.background = '#16a34a'; lbl.innerText = 'Stark – sehr sicher!'; }
        };

        window.switchSupervisorTab = function(tabKey) {
            const isUsers = tabKey === 'users';
            document.getElementById('supTabBtnPerms')?.classList.toggle('active', !isUsers);
            document.getElementById('supTabBtnUsers')?.classList.toggle('active', isUsers);
            document.getElementById('supPanePerms')?.classList.toggle('active', !isUsers);
            document.getElementById('supPaneUsers')?.classList.toggle('active', isUsers);
            if (isUsers && typeof window.renderSupervisorUsersList === 'function') {
                window.renderSupervisorUsersList();
            }
        };

        // =========================================================================
        // RED CINEMA WERBEVIDEO-PLAYER, SUPERVISOR MANAGER & RUND-LOGO ENGINE
        // =========================================================================
        window.brandAssetsData = JSON.parse(localStorage.getItem('red_brand_assets_v1') || 'null') || {
            roundLogoUrl: './red-logo-round.jpg',
            showFooterLogo: true
        };

        window.getAbsoluteBrandLogoUrl = function() {
            const raw = (window.brandAssetsData?.roundLogoUrl || './red-logo-round.jpg').trim();
            if (!raw || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
                return raw || './red-logo-round.jpg';
            }
            try { return new URL(raw, window.location.href).href; } catch (e) { return raw; }
        };

        window.applyBrandAssetsUI = function() {
            const src = (window.brandAssetsData?.roundLogoUrl || './red-logo-round.jpg').trim();
            const showFooter = window.brandAssetsData?.showFooterLogo !== false;

            const footerWrap = document.getElementById('footerCornerBrand');
            const footerImg = document.getElementById('footerCornerLogoImg');
            if (footerImg) footerImg.src = src;
            if (footerWrap) footerWrap.style.display = showFooter ? '' : 'none';

            const centerLogo = document.getElementById('rvpCenterBrandBadge');
            if (centerLogo) { centerLogo.src = src; centerLogo.style.display = 'block'; }

            const prevLogo = document.getElementById('vmBrandLogoPreview');
            if (prevLogo) prevLogo.src = src;
        };

        const DEFAULT_PROMO_VIDEOS_CFG = {
            placement: 'after-hero',
            autoplayMode: 'muted-auto',
            list: [
                {
                    id: 'vid-default-1',
                    title: 'Keine Wartenummer beim Amt – RED Berlin in 30 Sekunden',
                    badge: '30s Live-Einblick',
                    desc: 'Wozu stundenlang auf der Zulassungsstelle warten? Bei uns geben Sie Ihre Unterlagen ohne Wartezeit ab – wir prägen Ihre Schilder direkt vor Ort in der Kienitzer Str. 6, 12053 Berlin.',
                    url: './werbevideo-1.mp4',
                    aspect: '9/16'
                }
            ]
        };

        window.promoVideosConfig = JSON.parse(localStorage.getItem('red_promo_videos_v1') || 'null') || JSON.parse(JSON.stringify(DEFAULT_PROMO_VIDEOS_CFG));
        window.activePromoVideoIdx = 0;
        window._rvpUserStopped = false;
        window._rvpObserver = null;

        window.canManagePromoVideos = function() {
            return document.body.classList.contains('is-supervisor') ||
                (document.body.classList.contains('is-admin') && window.adminPermissions?.videos === true);
        };

        window.formatVideoTime = function(sec) {
            if (!isFinite(sec) || sec < 0) return '0:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m}:${String(s).padStart(2, '0')}`;
        };

        window.getRvpEl = function(scope) {
            return document.getElementById(scope === 'center' ? 'rvpCenterVideo' : 'rvpInlineVideo');
        };

        window.rvpSyncUi = function(scope) {
            const v = window.getRvpEl(scope);
            if (!v) return;
            const pfx = scope === 'center' ? 'rvpCenter' : 'rvpInline';

            const playBtn = document.getElementById(pfx + 'PlayBtn');
            if (playBtn) {
                playBtn.innerHTML = v.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
            }
            const muteBtn = document.getElementById(pfx + 'MuteBtn');
            if (muteBtn) {
                const isMuted = v.muted || v.volume === 0;
                muteBtn.innerHTML = isMuted
                    ? '<i class="fa-solid fa-volume-xmark" style="color:var(--primary-red);"></i>'
                    : (v.volume < 0.5 ? '<i class="fa-solid fa-volume-low"></i>' : '<i class="fa-solid fa-volume-high"></i>');
            }
            const volSlider = document.getElementById(pfx + 'Vol');
            if (volSlider) volSlider.value = v.muted ? 0 : v.volume;

            const curEl = document.getElementById(pfx + 'TimeCur');
            const durEl = document.getElementById(pfx + 'TimeDur');
            const seekEl = document.getElementById(pfx + 'Seek');
            if (curEl) curEl.innerText = window.formatVideoTime(v.currentTime);
            if (durEl) durEl.innerText = window.formatVideoTime(v.duration || 0);
            if (seekEl && v.duration) seekEl.value = ((v.currentTime / v.duration) * 100).toFixed(2);

            if (scope === 'inline') {
                const unmutePill = document.getElementById('rvpInlineUnmutePill');
                if (unmutePill) unmutePill.classList.toggle('is-hidden', !(v.muted || v.volume === 0) || v.paused);
            } else {
                const bigPlay = document.getElementById('rvpCenterBigPlay');
                if (bigPlay) bigPlay.classList.toggle('is-hidden', !v.paused);
            }
        };

        window.rvpTogglePlay = function(scope) {
            const v = window.getRvpEl(scope);
            if (!v) return;
            if (v.paused) {
                window._rvpUserStopped = false;
                v.play().catch(() => {});
            } else {
                window._rvpUserStopped = true;
                v.pause();
            }
            window.rvpSyncUi(scope);
        };

        window.rvpStop = function(scope) {
            const v = window.getRvpEl(scope);
            if (!v) return;
            window._rvpUserStopped = true;
            v.pause();
            v.currentTime = 0;
            window.rvpSyncUi(scope);
        };

        window.rvpSkip = function(scope, deltaSec) {
            const v = window.getRvpEl(scope);
            if (!v) return;
            const dur = isFinite(v.duration) ? v.duration : 9999;
            v.currentTime = Math.max(0, Math.min(dur, (v.currentTime || 0) + deltaSec));
            window.rvpSyncUi(scope);
        };

        window.rvpSeek = function(scope, pct) {
            const v = window.getRvpEl(scope);
            if (!v || !isFinite(v.duration)) return;
            v.currentTime = (parseFloat(pct) / 100) * v.duration;
            window.rvpSyncUi(scope);
        };

        window.rvpToggleMute = function(scope) {
            const v = window.getRvpEl(scope);
            if (!v) return;
            if (v.muted || v.volume === 0) {
                v.muted = false;
                if (v.volume === 0) v.volume = 0.85;
            } else {
                v.muted = true;
            }
            window.rvpSyncUi(scope);
        };

        window.rvpUnmuteAndPlay = function() {
            const v = window.getRvpEl('inline');
            if (!v) return;
            v.muted = false;
            if (v.volume === 0) v.volume = 0.85;
            window._rvpUserStopped = false;
            v.play().catch(() => {});
            window.rvpSyncUi('inline');
        };

        window.rvpSetVolume = function(scope, val) {
            const v = window.getRvpEl(scope);
            if (!v) return;
            const num = Math.max(0, Math.min(1, parseFloat(val) || 0));
            v.volume = num;
            v.muted = num === 0;
            window.rvpSyncUi(scope);
        };

        window.openVideoCenterModal = function() {
            const list = window.promoVideosConfig?.list || [];
            const item = list[window.activePromoVideoIdx] || list[0];
            if (!item) return;

            const inlineV = window.getRvpEl('inline');
            const centerV = window.getRvpEl('center');
            const ov = document.getElementById('redVideoCenterOverlay');
            if (!centerV || !ov) return;

            const resumeTime = inlineV ? inlineV.currentTime : 0;
            if (inlineV && !inlineV.paused) inlineV.pause();

            document.getElementById('rvpCenterTitle').innerText = item.title || 'RED Berlin Video';
            document.getElementById('rvpCenterSub').innerText = item.badge || 'RED Zulassungsdienst Berlin';
            window.applyBrandAssetsUI();

            if (centerV.getAttribute('data-src') !== item.url) {
                centerV.setAttribute('data-src', item.url);
                centerV.src = item.url;
            }
            centerV.muted = false;
            centerV.volume = inlineV && inlineV.volume > 0 ? inlineV.volume : 0.9;
            centerV.loop = true;

            const setPosAndPlay = () => {
                try { if (resumeTime > 0 && isFinite(centerV.duration)) centerV.currentTime = Math.min(resumeTime, centerV.duration - 0.1); } catch (e) {}
                centerV.play().catch(() => {
                    centerV.muted = true;
                    centerV.play().catch(() => {});
                });
                window.rvpSyncUi('center');
            };
            if (centerV.readyState >= 1) setPosAndPlay();
            else centerV.addEventListener('loadedmetadata', setPosAndPlay, { once: true });

            if (!centerV.dataset.bound) {
                centerV.dataset.bound = '1';
                ['timeupdate', 'loadedmetadata', 'play', 'pause', 'volumechange', 'ended'].forEach(ev => {
                    centerV.addEventListener(ev, () => window.rvpSyncUi('center'));
                });
            }

            ov.classList.add('open');
        };

        window.closeVideoCenterModal = function() {
            const ov = document.getElementById('redVideoCenterOverlay');
            const centerV = window.getRvpEl('center');
            const inlineV = window.getRvpEl('inline');
            const curTime = centerV ? centerV.currentTime : 0;
            if (centerV) centerV.pause();
            if (ov) ov.classList.remove('open');
            if (inlineV) {
                try { if (curTime > 0 && isFinite(inlineV.duration)) inlineV.currentTime = Math.min(curTime, inlineV.duration - 0.1); } catch (e) {}
                if (!window._rvpUserStopped && window.promoVideosConfig?.autoplayMode !== 'manual') {
                    inlineV.muted = true;
                    inlineV.play().catch(() => {});
                }
                window.rvpSyncUi('inline');
            }
        };

        window.selectPromoVideo = function(idx) {
            window.activePromoVideoIdx = idx;
            window._rvpUserStopped = false;
            window.renderPromoVideoShowcase();
        };

        window.positionVideoShowcaseHost = function(placement) {
            const host = document.getElementById('redVideoShowcaseHost');
            const viewHome = document.getElementById('view-home');
            if (!host || !viewHome) return;

            if (placement === 'before-termin') {
                const terminSec = document.getElementById('termin');
                if (terminSec && terminSec.parentNode) terminSec.parentNode.insertBefore(host, terminSec);
            } else if (placement === 'in-neukoelln') {
                const nkSec = document.getElementById('neukoelln-lokal');
                if (nkSec && nkSec.parentNode) nkSec.parentNode.insertBefore(host, nkSec.nextSibling);
            } else {
                const dynHome = document.getElementById('dynamic-client-section-home');
                if (dynHome && dynHome.parentNode) dynHome.parentNode.insertBefore(host, dynHome);
            }
        };

        window.renderPromoVideoShowcase = function() {
            const host = document.getElementById('redVideoShowcaseHost');
            if (!host) return;
            const cfg = window.promoVideosConfig || DEFAULT_PROMO_VIDEOS_CFG;
            const list = Array.isArray(cfg.list) ? cfg.list : [];
            const isMgr = window.canManagePromoVideos();

            if (window._rvpObserver) { window._rvpObserver.disconnect(); window._rvpObserver = null; }

            if (cfg.placement === 'hidden' || list.length === 0) {
                host.innerHTML = isMgr
                    ? `<div class="admin-pro-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;"><span style="font-size:12px; font-weight:700; color:var(--text-muted);"><i class="fa-solid fa-film" style="color:var(--primary-red);"></i> Werbevideo-Player ist aktuell ausgeblendet.</span><button type="button" class="admin-pro-btn admin-pro-btn-primary admin-pro-btn-sm" onclick="window.openVideoManagerModal('videos')"><i class="fa-solid fa-sliders"></i> Video-Studio öffnen</button></div>`
                    : '';
                return;
            }

            window.positionVideoShowcaseHost(cfg.placement || 'after-hero');
            if (window.activePromoVideoIdx >= list.length) window.activePromoVideoIdx = 0;
            const item = list[window.activePromoVideoIdx];
            const isLandscape = item.aspect === '16/9';
            const autoStart = cfg.autoplayMode !== 'manual';

            const playlistHtml = list.length > 1
                ? `<div class="rvp-playlist-bar">${list.map((v, i) => `<button type="button" class="rvp-playlist-chip ${i === window.activePromoVideoIdx ? 'active' : ''}" onclick="window.selectPromoVideo(${i})"><i class="fa-solid fa-play"></i> ${window.escHtml(v.badge || ('Video ' + (i + 1)))}</button>`).join('')}</div>`
                : '';

            host.innerHTML = `
                <div class="rvp-showcase-card ${isLandscape ? 'is-landscape' : ''}">
                    <div class="rvp-player-shell">
                        <div class="rvp-media-stage" style="--rvp-aspect:${window.escHtml(item.aspect || '9/16')};">
                            <div class="rvp-overlay-top">
                                <span class="rvp-badge-pill"><i class="fa-solid fa-circle-play"></i> ${window.escHtml(item.badge || 'RED Video')}</span>
                                <button type="button" class="rvp-expand-fab" onclick="event.stopPropagation(); window.openVideoCenterModal()" title="Im Kino-Rahmen vergrößern"><i class="fa-solid fa-expand"></i></button>
                            </div>
                            <video id="rvpInlineVideo" src="${window.escHtml(item.url)}" ${autoStart ? 'autoplay' : ''} muted loop playsinline preload="metadata" onclick="window.rvpTogglePlay('inline')"></video>
                            <button type="button" class="rvp-unmute-callout" id="rvpInlineUnmutePill" onclick="event.stopPropagation(); window.rvpUnmuteAndPlay()">
                                <i class="fa-solid fa-volume-high"></i> Ton einschalten
                            </button>
                        </div>
                        <div class="rvp-controls-bar">
                            <div class="rvp-seek-row">
                                <span class="rvp-time" id="rvpInlineTimeCur">0:00</span>
                                <input type="range" id="rvpInlineSeek" class="rvp-range rvp-seek" min="0" max="100" step="0.1" value="0" oninput="window.rvpSeek('inline', this.value)">
                                <span class="rvp-time" id="rvpInlineTimeDur">0:00</span>
                            </div>
                            <div class="rvp-btn-row">
                                <div class="rvp-btn-group">
                                    <button type="button" class="rvp-ctrl-btn" onclick="window.rvpSkip('inline', -5)" title="5s zurück"><i class="fa-solid fa-rotate-left"></i><span>5s</span></button>
                                    <button type="button" class="rvp-ctrl-btn rvp-btn-primary" id="rvpInlinePlayBtn" onclick="window.rvpTogglePlay('inline')" title="Play / Pause"><i class="fa-solid fa-pause"></i></button>
                                    <button type="button" class="rvp-ctrl-btn" onclick="window.rvpStop('inline')" title="Stopp"><i class="fa-solid fa-stop"></i></button>
                                    <button type="button" class="rvp-ctrl-btn" onclick="window.rvpSkip('inline', 5)" title="5s vor"><i class="fa-solid fa-rotate-right"></i><span>5s</span></button>
                                </div>
                                <div class="rvp-vol-group">
                                    <button type="button" class="rvp-ctrl-btn" id="rvpInlineMuteBtn" onclick="window.rvpToggleMute('inline')" title="Ton Ein/Aus"><i class="fa-solid fa-volume-xmark" style="color:var(--primary-red);"></i></button>
                                    <input type="range" id="rvpInlineVol" class="rvp-range rvp-vol" min="0" max="1" step="0.05" value="0" oninput="window.rvpSetVolume('inline', this.value)" aria-label="Lautstärke">
                                    <button type="button" class="rvp-ctrl-btn" onclick="window.openVideoCenterModal()" title="Vergrößern"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="rvp-info-col">
                        <div class="rvp-info-head">
                            <div>
                                <span class="shop-gallery-eyebrow"><i class="fa-solid fa-film"></i> RED Berlin in Aktion</span>
                                <h2>${window.escHtml(item.title || 'RED Zulassungsdienst Berlin')}</h2>
                            </div>
                            <button type="button" class="admin-pro-btn admin-pro-btn-secondary admin-pro-btn-sm action-videos" onclick="window.openVideoManagerModal('videos')" title="Videos bearbeiten, ersetzen oder verschieben">
                                <i class="fa-solid fa-sliders"></i> Verwalten
                            </button>
                        </div>
                        <p>${window.escHtml(item.desc || '')}</p>
                        <ul class="rvp-highlights-list">
                            <li><i class="fa-solid fa-circle-check"></i><span>Keine Wartenummer beim Amt – Abgabe in 5&nbsp;Minuten</span></li>
                            <li><i class="fa-solid fa-circle-check"></i><span>Sofort-Kennzeichenprägung direkt vor Ort in der Kienitzer&nbsp;Str.&nbsp;6</span></li>
                            <li><i class="fa-solid fa-circle-check"></i><span>Anmeldung, Ummeldung, Abmeldung, Kurzzeit- &amp; Zollkennzeichen</span></li>
                        </ul>
                        <div class="rvp-cta-row">
                            <button type="button" class="btn-primary" onclick="window.desktopNavGo('termin')"><i class="fa-regular fa-calendar-check"></i> Jetzt Wunschtermin sichern</button>
                            <button type="button" class="btn-primary" style="background:#25D366; color:#000; box-shadow:none;" onclick="window.startPhotoPreCheckWhatsApp(false)"><i class="fa-brands fa-whatsapp"></i> Direkt per WhatsApp</button>
                        </div>
                        ${playlistHtml}
                    </div>
                </div>
            `;

            const v = document.getElementById('rvpInlineVideo');
            if (v) {
                v.muted = true;
                ['timeupdate', 'loadedmetadata', 'play', 'pause', 'volumechange', 'ended'].forEach(ev => {
                    v.addEventListener(ev, () => window.rvpSyncUi('inline'));
                });
                if (autoStart) {
                    v.play().catch(() => {});
                }
                window.rvpSyncUi('inline');

                if (typeof IntersectionObserver !== 'undefined') {
                    window._rvpObserver = new IntersectionObserver((entries) => {
                        entries.forEach(en => {
                            if (!en.isIntersecting && !v.paused) {
                                v.pause();
                            } else if (en.isIntersecting && autoStart && !window._rvpUserStopped && !document.getElementById('redVideoCenterOverlay')?.classList.contains('open')) {
                                v.play().catch(() => {});
                            }
                        });
                    }, { threshold: 0.25 });
                    window._rvpObserver.observe(v);
                }
            }
        };

        // --- SUPERVISOR / ADMIN VIDEO- & LOGO-MANAGER ---
        window.persistPromoVideosConfig = async function() {
            localStorage.setItem('red_promo_videos_v1', JSON.stringify(window.promoVideosConfig));
            window.renderPromoVideoShowcase();
            window.renderVideoManagerList();
            if (window.firebaseDb && window.firebaseSetDoc) {
                try {
                    await window.firebaseSetDoc(
                        window.firebaseDoc(window.firebaseDb, "settings", "promo_videos"),
                        { ...window.promoVideosConfig, updatedAt: Date.now() },
                        { merge: true }
                    );
                } catch (e) { console.error('Promo-Videos Sync Fehler:', e); }
            }
        };

        window.switchVideoManagerTab = function(tabKey) {
            const isBrand = tabKey === 'brand';
            document.getElementById('vmTabBtnVideos')?.classList.toggle('active', !isBrand);
            document.getElementById('vmTabBtnBrand')?.classList.toggle('active', isBrand);
            if (document.getElementById('vmPaneVideos')) document.getElementById('vmPaneVideos').style.display = isBrand ? 'none' : 'block';
            if (document.getElementById('vmPaneBrand')) document.getElementById('vmPaneBrand').style.display = isBrand ? 'block' : 'none';
            if (isBrand) {
                window.applyBrandAssetsUI();
                const uInp = document.getElementById('vmBrandUrlInput');
                const cur = window.brandAssetsData?.roundLogoUrl || './red-logo-round.jpg';
                if (uInp) uInp.value = cur.startsWith('data:') ? '' : cur;
                const chk = document.getElementById('vmShowFooterLogo');
                if (chk) chk.checked = window.brandAssetsData?.showFooterLogo !== false;
            }
        };

        window.openVideoManagerModal = function(startTab = 'videos') {
            if (!window.canManagePromoVideos()) {
                window.showToast('Nur der Supervisor oder ein freigeschalteter Admin darf Videos & Logo verwalten.', 'error');
                return;
            }
            const cfg = window.promoVideosConfig || DEFAULT_PROMO_VIDEOS_CFG;
            if (document.getElementById('vmPlacementSelect')) document.getElementById('vmPlacementSelect').value = cfg.placement || 'after-hero';
            if (document.getElementById('vmAutoplaySelect')) document.getElementById('vmAutoplaySelect').value = cfg.autoplayMode || 'muted-auto';
            window.renderVideoManagerList();
            window.switchVideoManagerTab(startTab === 'brand' ? 'brand' : 'videos');
            document.getElementById('videoManagerOverlay').classList.add('open');
            setTimeout(() => { if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays(); }, 40);
        };

        window.closeVideoManagerModal = function() {
            document.getElementById('videoManagerOverlay').classList.remove('open');
        };

        window.saveVideoSettingsOnly = async function() {
            window.promoVideosConfig.placement = document.getElementById('vmPlacementSelect')?.value || 'after-hero';
            window.promoVideosConfig.autoplayMode = document.getElementById('vmAutoplaySelect')?.value || 'muted-auto';
            await window.persistPromoVideosConfig();
            window.showToast('Video-Platzierung & Verhalten gespeichert!', 'success');
        };

        window.resetVideoManagerForm = function() {
            document.getElementById('vmEditId').value = '';
            document.getElementById('vmTitle').value = '';
            document.getElementById('vmBadge').value = '';
            document.getElementById('vmDesc').value = '';
            document.getElementById('vmUrl').value = '';
            if (document.getElementById('vmAspect')) document.getElementById('vmAspect').value = '9/16';
            if (document.getElementById('vmFileInput')) document.getElementById('vmFileInput').value = '';
            if (document.getElementById('vmFormHeading')) document.getElementById('vmFormHeading').innerText = '2. Video hinzufügen oder bearbeiten';
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
        };

        window.handlePromoVideoFileSelect = function(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            if (file.size > 680 * 1024) {
                window.showToast('Video ist größer als 680 KB – bitte direkt als MP4 in deinen Website-Ordner hochladen und oben z.B. ./werbevideo-1.mp4 eintragen!', 'error');
                input.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('vmUrl').value = ev.target.result;
                window.showToast(`Video „${file.name}“ geladen – jetzt speichern!`, 'success');
            };
            reader.readAsDataURL(file);
        };

        window.savePromoVideoItem = async function() {
            const editId = document.getElementById('vmEditId').value;
            const title = document.getElementById('vmTitle').value.trim();
            const badge = document.getElementById('vmBadge').value.trim() || 'RED Video';
            const desc = document.getElementById('vmDesc').value.trim();
            const url = document.getElementById('vmUrl').value.trim();
            const aspect = document.getElementById('vmAspect')?.value || '9/16';

            if (!title || !url) {
                window.showToast('Bitte Überschrift und Video-Pfad / Link eingeben.', 'error');
                return;
            }
            if (!Array.isArray(window.promoVideosConfig.list)) window.promoVideosConfig.list = [];
            const rec = { id: editId || ('vid-' + Date.now()), title, badge, desc, url, aspect };

            if (editId) {
                const idx = window.promoVideosConfig.list.findIndex(v => v.id === editId);
                if (idx > -1) window.promoVideosConfig.list[idx] = rec;
            } else {
                window.promoVideosConfig.list.push(rec);
                window.activePromoVideoIdx = window.promoVideosConfig.list.length - 1;
            }

            await window.persistPromoVideosConfig();
            window.resetVideoManagerForm();
            window.showToast(editId ? 'Werbevideo aktualisiert!' : 'Neues Werbevideo veröffentlicht!', 'success');
        };

        window.editPromoVideoItem = function(id) {
            const item = (window.promoVideosConfig?.list || []).find(v => v.id === id);
            if (!item) return;
            document.getElementById('vmEditId').value = item.id;
            document.getElementById('vmTitle').value = item.title || '';
            document.getElementById('vmBadge').value = item.badge || '';
            document.getElementById('vmDesc').value = item.desc || '';
            document.getElementById('vmUrl').value = item.url || '';
            if (document.getElementById('vmAspect')) document.getElementById('vmAspect').value = item.aspect || '9/16';
            if (document.getElementById('vmFormHeading')) document.getElementById('vmFormHeading').innerText = `2. Video bearbeiten: ${item.badge || item.title}`;
            if (typeof window.syncAllMobileSelectDisplays === 'function') window.syncAllMobileSelectDisplays();
            document.getElementById('vmPaneVideos')?.scrollTo({ top: 0, behavior: 'smooth' });
        };

        window.deletePromoVideoItem = function(id) {
            const item = (window.promoVideosConfig?.list || []).find(v => v.id === id);
            if (!item) return;
            window.openRedDeleteConfirm(
                'Werbevideo löschen?',
                `Möchten Sie „${item.title}“ wirklich dauerhaft entfernen?`,
                async () => {
                    window.promoVideosConfig.list = (window.promoVideosConfig.list || []).filter(v => v.id !== id);
                    window.activePromoVideoIdx = 0;
                    await window.persistPromoVideosConfig();
                    window.showToast('Werbevideo entfernt.', 'success');
                }
            );
        };

        window.renderVideoManagerList = function() {
            const listEl = document.getElementById('vmVideosList');
            const cntEl = document.getElementById('vmVideoCount');
            const list = window.promoVideosConfig?.list || [];
            if (cntEl) cntEl.innerText = String(list.length);
            if (!listEl) return;
            if (list.length === 0) {
                listEl.innerHTML = '<div style="text-align:center; padding:14px; font-size:12px; color:var(--text-muted);">Noch keine Werbevideos eingetragen.</div>';
                return;
            }
            listEl.innerHTML = list.map(v => `
                <div class="pm-page-card">
                    <div class="pm-page-info">
                        <strong><i class="fa-solid fa-film" style="color:var(--primary-red); margin-right:6px;"></i>${window.escHtml(v.title)}</strong>
                        <span>${window.escHtml(v.badge || 'Video')} • Format ${window.escHtml(v.aspect || '9/16')}</span>
                    </div>
                    <div class="pm-page-actions">
                        <button type="button" class="apt-btn edit" onclick="window.editPromoVideoItem('${v.id}')" title="Bearbeiten / Ersetzen"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="apt-btn delete" onclick="window.deletePromoVideoItem('${v.id}')" title="Löschen"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
        };

        window.handleBrandLogoUpload = async function(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                // Schneidet das Bild automatisch quadratisch aus der Mitte (perfekt für das runde RED-Logo)
                const dataUrl = await new Promise((resolve, reject) => {
                    const r = new FileReader();
                    r.onerror = reject;
                    r.onload = (ev) => {
                        const img = new Image();
                        img.onerror = reject;
                        img.onload = () => {
                            const size = Math.min(img.naturalWidth, img.naturalHeight);
                            const sx = Math.floor((img.naturalWidth - size) / 2);
                            const sy = Math.floor((img.naturalHeight - size) / 2);
                            const out = 512;
                            const c = document.createElement('canvas');
                            c.width = out; c.height = out;
                            const ctx = c.getContext('2d');
                            ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out);
                            resolve(c.toDataURL('image/jpeg', 0.88));
                        };
                        img.src = ev.target.result;
                    };
                    r.readAsDataURL(file);
                });
                window.brandAssetsData.roundLogoUrl = dataUrl;
                if (document.getElementById('vmBrandUrlInput')) document.getElementById('vmBrandUrlInput').value = '';
                window.applyBrandAssetsUI();
                await window.saveBrandLogoSettings(true);
            } catch (err) {
                window.showToast('Logo konnte nicht verarbeitet werden.', 'error');
            }
        };

        window.saveBrandLogoSettings = async function(keepDataUrl = false) {
            const urlInp = (document.getElementById('vmBrandUrlInput')?.value || '').trim();
            if (!keepDataUrl && urlInp) {
                window.brandAssetsData.roundLogoUrl = urlInp;
            }
            window.brandAssetsData.showFooterLogo = document.getElementById('vmShowFooterLogo')?.checked !== false;
            localStorage.setItem('red_brand_assets_v1', JSON.stringify(window.brandAssetsData));
            window.applyBrandAssetsUI();
            if (window.firebaseDb && window.firebaseSetDoc) {
                try {
                    await window.firebaseSetDoc(
                        window.firebaseDoc(window.firebaseDb, "settings", "brand_assets"),
                        { ...window.brandAssetsData, updatedAt: Date.now() },
                        { merge: true }
                    );
                } catch (e) {}
            }
            window.showToast('RED Rund-Logo global gespeichert!', 'success');
        };

        window.resetBrandLogoDefault = async function() {
            window.brandAssetsData = { roundLogoUrl: './red-logo-round.jpg', showFooterLogo: true };
            if (document.getElementById('vmBrandUrlInput')) document.getElementById('vmBrandUrlInput').value = './red-logo-round.jpg';
            if (document.getElementById('vmShowFooterLogo')) document.getElementById('vmShowFooterLogo').checked = true;
            await window.saveBrandLogoSettings(true);
        };

        document.addEventListener('DOMContentLoaded', () => {
            window.applyBrandAssetsUI();
            window.renderPromoVideoShowcase();
        });