/*
  Breathe Woods booking prototype
  Mock data only. All pricing and inventory rules are deliberately easy to replace
  with the confirmed owner configuration in the production build.
*/
const DAY = 86400000;
const startMonth = new Date(2026, 9, 1); // October 2026; deliberately seeded test month
// Working weekend-room rule: a solo traveller or couple may book an individual
// room across Friday/Saturday only when the full stay is 4 nights or longer.
// Keep this as one explicit policy value, rather than a demand/lead-time algorithm.
const WEEKEND_ROOM_MIN_NIGHTS = 4;
const BOOKING_WINDOW_MONTHS = 12;
const HOST_MESSAGE_TEST_RECIPIENT = 'sanil.prashant@gmail.com'; // Configure as the Netlify notification recipient after deployment.
const fmtMoney = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(n));
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromIso = value => { const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d); };
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const nightsBetween = (start, end) => Math.round((end - start) / DAY);
const formatDate = value => fromIso(value).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
const fullDate = value => fromIso(value).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

const resources = {
  zen1: { villa: 'zen', name: 'Zen Room 1', capacity: 2 },
  zen2: { villa: 'zen', name: 'Zen Room 2', capacity: 2 },
  boug1: { villa: 'boug', name: 'Bougan’villa Room 1', capacity: 2 },
  boug2: { villa: 'boug', name: 'Bougan’villa Room 2', capacity: 2 },
  boug3: { villa: 'boug', name: 'Bougan’villa Room 3', capacity: 2 },
};
const villas = {
  zen: { name: 'Zen Villa', rooms:['zen1','zen2'], includedGuests:4, maximum:6, rates:{ breakfast:17000, oneMeal:18500, allMeals:20000 } },
  boug: { name: 'Bougan’villa', rooms:['boug1','boug2','boug3'], includedGuests:6, maximum:9, rates:{ breakfast:26000, oneMeal:28000, allMeals:30000 } },
};
const petLimits = { room:1, villa:2, property:3 };

// Every item below represents the kind of real reservation/block that the final system must handle.
const mockReservations = [
  { id:'R-101', guest:'Shah family', start:'2026-10-06', end:'2026-10-09', resources:['zen1'], kind:'confirmed', note:'One weekday room booked' },
  { id:'R-102', guest:'Kulkarni group', start:'2026-10-12', end:'2026-10-14', resources:['boug2'], kind:'confirmed', note:'One Bougan’villa room booked' },
  { id:'R-103', guest:'D’Souza family', start:'2026-10-15', end:'2026-10-17', resources:['zen1','zen2'], kind:'confirmed', note:'Whole Zen Villa booked' },
  { id:'R-104', guest:'Nair group', start:'2026-10-23', end:'2026-10-26', resources:['boug1','boug2','boug3'], kind:'confirmed', note:'Weekend Bougan’villa booking' },
  { id:'R-105', guest:'Private retreat', start:'2026-10-30', end:'2026-11-02', resources:['zen1','zen2','boug1','boug2','boug3'], kind:'confirmed', note:'Entire property booked' },
  { id:'R-106', guest:'Room booking A', start:'2026-11-03', end:'2026-11-06', resources:['boug1'], kind:'confirmed', note:'Room remains beside another guest' },
  { id:'R-107', guest:'Room booking B', start:'2026-11-03', end:'2026-11-06', resources:['boug3'], kind:'confirmed', note:'Only Bougan’villa Room 2 remains' },
  { id:'B-201', guest:'Owner stay', start:'2026-11-20', end:'2026-11-23', resources:['zen1','zen2','boug1','boug2','boug3'], kind:'owner-block', note:'Owner block' },
  { id:'H-301', guest:'Guest checkout pending', start:'2026-11-27', end:'2026-11-29', resources:['zen2'], kind:'hold', note:'Temporary 20-minute hold' },
];
// Demonstrates the manager-controlled holiday calendar. Use real Indian/Maharashtra dates in production.
const holidayWindows = [
  { start:'2026-10-09', end:'2026-10-12', title:'Friday 9 October holiday weekend', minNights:2 },
  { start:'2026-12-24', end:'2026-12-29', title:'Demo festive-period rule', minNights:2 },
];
const scenarios = [
  { label:'6–8 Oct', start:'2026-10-06', end:'2026-10-08', text:'Zen Room 1 is booked; Zen Room 2 can still be tried for a weekday stay.' },
  { label:'15–17 Oct', start:'2026-10-15', end:'2026-10-17', text:'Zen Villa is fully booked, so neither Zen room should be offered.' },
  { label:'23–25 Oct', start:'2026-10-23', end:'2026-10-25', text:'A Friday–Sunday Bougan’villa booking blocks the full villa.' },
  { label:'20–24 Oct', start:'2026-10-20', end:'2026-10-24', text:'A four-night stay that includes Friday can show eligible individual rooms; a shorter Fri/Sat stay shows villas only.' },
  { label:'30 Oct–1 Nov', start:'2026-10-30', end:'2026-11-01', text:'Entire property booked; all five rooms should be unavailable.' },
  { label:'3–5 Nov', start:'2026-11-03', end:'2026-11-05', text:'Two Bougan’villa rooms are booked; only one room remains.' },
  { label:'20–22 Nov', start:'2026-11-20', end:'2026-11-22', text:'Owner block prevents every guest booking.' },
  { label:'27–28 Nov', start:'2026-11-27', end:'2026-11-28', text:'Temporary hold makes one room unavailable pending expiry.' },
  { label:'9–11 Oct', start:'2026-10-09', end:'2026-10-11', text:'The second Friday is configured as a holiday: try 9→10 Oct to see the 2-night rule, then 9→11 Oct to continue.' },
];

const state = {
  visibleMonth: new Date(startMonth),
  checkIn: null,
  checkOut: null,
  selectedStay: null,
  adults: 2,
  children: 0,
  toddlers: 0,
  pets: 0,
  mealPlan: 'allMeals',
  dietary: 'mixed',
  addOns: { bbqSessions: 0, lakeTrips: 0 },
  promo: '',
  guest: { name:'', phone:'', email:'', arrival:'', note:'', consent:false },
  paymentMethod: 'upi',
  configuration: {
    allowWeekendRooms: false,
    offer: null,
    customHolidayWindows: [],
    customBlocks: [],
  },
};

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}
function blockedResourcesForStay(start, end) {
  const blocked = new Set();
  [...mockReservations, ...state.configuration.customBlocks].forEach(res => {
    if (overlaps(start, end, fromIso(res.start), fromIso(res.end))) res.resources.forEach(r => blocked.add(r));
  });
  return blocked;
}
function blockedForDate(date) {
  return blockedResourcesForStay(date, addDays(date, 1));
}
function isInHoliday(date) {
  return [...holidayWindows, ...state.configuration.customHolidayWindows].find(w => date >= fromIso(w.start) && date < fromIso(w.end));
}
function getStayRestriction(start, end) {
  const matched = [...holidayWindows, ...state.configuration.customHolidayWindows].find(w => overlaps(start, end, fromIso(w.start), fromIso(w.end)));
  return matched ? { minNights: matched.minNights, title: matched.title } : { minNights: 1, title: null };
}
function stayIncludesWeekend(start, end) {
  for (let d = new Date(start); d < end; d = addDays(d, 1)) if ([5,6].includes(d.getDay())) return true;
  return false;
}
function dayStatus(date) {
  const blocked = blockedForDate(date);
  if (blocked.size === Object.keys(resources).length) return 'blocked';
  if (blocked.size > 0) return 'limited';
  return 'available';
}
function getAvailableStays() {
  if (!state.checkIn || !state.checkOut) return [];
  const blocked = blockedResourcesForStay(state.checkIn, state.checkOut);
  const hasWeekend = stayIncludesWeekend(state.checkIn, state.checkOut);
  const nights = nightsBetween(state.checkIn, state.checkOut);
  const roomsEligible = state.configuration.allowWeekendRooms || !hasWeekend || nights >= WEEKEND_ROOM_MIN_NIGHTS;
  const stays = [];
  const villaFree = key => villas[key].rooms.every(r => !blocked.has(r));
  if (roomsEligible) {
    Object.entries(resources).forEach(([key, room]) => {
      if (!blocked.has(key)) stays.push({ id:key, type:'room', name:room.name, villa:room.villa, capacity:room.capacity });
    });
  }
  Object.entries(villas).forEach(([key, villa]) => {
    if (villaFree(key)) stays.push({ id:key, type:'villa', name:villa.name, villa:key, includedGuests:villa.includedGuests, capacity:villa.maximum });
  });
  if (villaFree('zen') && villaFree('boug')) stays.push({ id:'property', type:'property', name:'Entire Breathe Woods', capacity:15, includedGuests:10 });
  return stays;
}
function mealLabel(plan) { return ({breakfast:'Breakfast only',oneMeal:'Breakfast + 1 meal',allMeals:'All meals'})[plan]; }
function roomRate(adults, children, plan) {
  // Current owner tariff only defines solo and couple stays. Children in room stays need confirmation.
  const base = adults <= 1 && children === 0 ? { breakfast:4000, oneMeal:4500, allMeals:5000 } : { breakfast:5500, oneMeal:6250, allMeals:7000 };
  return base[plan];
}
function offerForStay(start, end) {
  const offer = state.configuration.offer;
  if (!offer || !offer.start || !offer.end || !offer.percent) return { discountedNights: 0, offer: null };
  let discountedNights = 0;
  for (let d = new Date(start); d < end; d = addDays(d, 1)) {
    if (d >= fromIso(offer.start) && d < fromIso(offer.end)) discountedNights++;
  }
  return { discountedNights, offer };
}
function calculatePrice() {
  if (!state.selectedStay || !state.checkIn || !state.checkOut) return null;
  const nights = nightsBetween(state.checkIn, state.checkOut);
  const s = state.selectedStay;
  let nightly = 0, extras = 0, labels=[];
  let refundableDeposit = 0;
  // In the prototype, an add-on applies to everyone in the booking party.
  const partySize = Math.max(1, state.adults + state.children + state.toddlers);
  if (s.type === 'room') {
    nightly = roomRate(state.adults, state.children, state.mealPlan);
    labels.push(`${state.adults <= 1 && state.children === 0 ? 'Solo' : 'Couple'} weekday room rate`);
  } else if (s.type === 'villa') {
    const villa = villas[s.villa];
    nightly = villa.rates[state.mealPlan];
    // The base villa tariff is an allowance, not a minimum number of people.
    // Adults consume the included allowance first; this is a working rule pending owner confirmation.
    const adultExtra = Math.max(0, state.adults - villa.includedGuests) * 3500;
    const childExtra = Math.max(0, state.children - Math.max(0, villa.includedGuests - state.adults)) * 3000;
    nightly += adultExtra + childExtra;
    if (adultExtra) labels.push(`${state.adults - villa.includedGuests} additional adult(s)`);
    if (childExtra) labels.push(`${state.children} child(ren), 7–12`);
  } else {
    const guestCount = state.adults + state.children + state.toddlers;
    const regular = 50000 + Math.max(0, guestCount - 10) * 3500;
    const benefit = nights >= 2 ? Math.min(.20, .15 + Math.max(0, guestCount - 10) * .01) : Math.min(.10, .075 + Math.max(0, guestCount - 10) * .005);
    nightly = regular * (1 - benefit);
    labels.push(`${Math.round(benefit * 100)}% group benefit (working rule)`);
  }
  if (state.addOns.bbqSessions > 0) {
    extras += 500 * partySize * state.addOns.bbqSessions;
    labels.push(`Bonfire + BBQ · ${partySize} guest(s) × ${state.addOns.bbqSessions} evening${state.addOns.bbqSessions > 1 ? 's' : ''}`);
  }
  if (state.addOns.lakeTrips > 0) {
    const cars = Math.ceil(partySize / 4);
    extras += 500 * cars * state.addOns.lakeTrips;
    labels.push(`Lake trip · ${cars} car(s) × ${state.addOns.lakeTrips} outing${state.addOns.lakeTrips > 1 ? 's' : ''}`);
  }
  if (state.pets > 0) {
    extras += 2000 * state.pets * nights;
    refundableDeposit = 5000;
    labels.push(`Pet stay · ${state.pets} pet${state.pets > 1 ? 's' : ''} × ₹2,000/night × ${nights} night${nights > 1 ? 's' : ''}`);
  }
  const undiscountedStayTotal = nightly * nights;
  const { discountedNights, offer } = offerForStay(state.checkIn, state.checkOut);
  const offerDiscount = offer ? Math.round(nightly * discountedNights * (offer.percent / 100)) : 0;
  if (offerDiscount) labels.push(`${offer.label || 'Offer'} · ${offer.percent}% off ${discountedNights} night${discountedNights > 1 ? 's' : ''}`);
  const stayTotal = undiscountedStayTotal - offerDiscount;
  const total = stayTotal + extras;
  return { nights, nightly, stayTotal, undiscountedStayTotal, offerDiscount, extras, total, refundableDeposit, totalWithDeposit:total+refundableDeposit, labels };
}
function paymentSchedule() {
  const price = calculatePrice();
  if (!price) return null;
  // Working direct-booking policy: 60% of the non-refundable booking total,
  // plus any refundable pet deposit, is paid at checkout. The rest is due before arrival.
  const stayAdvance = Math.ceil(price.total * 0.60);
  return {
    stayAdvance,
    refundableDeposit: price.refundableDeposit,
    dueNow: stayAdvance + price.refundableDeposit,
    balance: price.total - stayAdvance,
  };
}

function renderCalendar() {
  const root = document.getElementById('calendars');
  const earliest = new Date(2026, 8, 1);
  const latest = new Date(earliest.getFullYear(), earliest.getMonth() + BOOKING_WINDOW_MONTHS - 1, 1);
  const previous = document.getElementById('previousMonth');
  const next = document.getElementById('nextMonth');
  document.getElementById('mobileMonthLabel').textContent = state.visibleMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  previous.disabled = state.visibleMonth <= earliest;
  next.disabled = state.visibleMonth >= latest;
  root.innerHTML = '';
  for (let monthOffset=0; monthOffset<2; monthOffset++) {
    const month = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth()+monthOffset, 1);
    const wrap = document.createElement('div'); wrap.className='calendar-month';
    const heading = document.createElement('h3'); heading.textContent=month.toLocaleDateString('en-IN',{month:'long',year:'numeric'}); wrap.appendChild(heading);
    const week=document.createElement('div');week.className='weekday-row'; ['S','M','T','W','T','F','S'].forEach(x=>{let el=document.createElement('span');el.textContent=x;week.appendChild(el)});wrap.appendChild(week);
    const days=document.createElement('div');days.className='calendar-days';
    const firstDay=month.getDay(), total=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let i=0;i<firstDay;i++){ const blank=document.createElement('span');days.appendChild(blank); }
    for(let day=1;day<=total;day++){
      const date=new Date(month.getFullYear(),month.getMonth(),day), key=iso(date), status=dayStatus(date);
      const button=document.createElement('button'); button.type='button';button.className=`date-cell ${status}`;button.dataset.date=key;button.innerHTML=`<span>${day}</span><i class="availability-mark"></i>`;
      const isPast=date<new Date(2026,8,28);
      if(isPast) button.disabled=true;
      if(state.checkIn && key===iso(state.checkIn)) button.classList.add('selected','selected-start');
      if(state.checkOut && key===iso(state.checkOut)) button.classList.add('selected','selected-end');
      if(state.checkIn && state.checkOut && date>state.checkIn && date<state.checkOut) button.classList.add('in-range');
      if(status==='blocked') button.title='Unavailable: all accommodation is booked or blocked';
      else if(status==='limited') button.title='Limited availability: some rooms are already booked';
      else if(isInHoliday(date)) button.title='Holiday period: minimum two-night stay';
      button.addEventListener('click',()=>selectDate(date)); days.appendChild(button);
    }
    wrap.appendChild(days);root.appendChild(wrap);
  }
}
function selectDate(date) {
  if (!state.checkIn || (state.checkIn && state.checkOut) || date < state.checkIn) {
    state.checkIn=date;state.checkOut=null;state.selectedStay=null;
  } else if (date.getTime()===state.checkIn.getTime()) {
    state.checkIn=null;state.checkOut=null;state.selectedStay=null;
  } else {
    state.checkOut=date;state.selectedStay=null;
  }
  renderAll();
}
function renderDateSummary() {
  const el=document.getElementById('dateSummary');
  if(!state.checkIn){el.textContent='Choose your check-in and check-out dates.';return;}
  if(!state.checkOut){el.textContent=`Check-in: ${fullDate(iso(state.checkIn))}. Now choose check-out.`;return;}
  const nights=nightsBetween(state.checkIn,state.checkOut), restriction=getStayRestriction(state.checkIn,state.checkOut);
  if(nights<restriction.minNights) {el.innerHTML=`<b>${restriction.title}</b> needs a minimum ${restriction.minNights}-night stay. Please choose a later check-out.`;return;}
  const weekend=stayIncludesWeekend(state.checkIn,state.checkOut);
  const roomWeekendNote=weekend?(nights>=WEEKEND_ROOM_MIN_NIGHTS?` · Rooms eligible: ${WEEKEND_ROOM_MIN_NIGHTS}+ night stay`:` · Rooms need a ${WEEKEND_ROOM_MIN_NIGHTS}-night stay when Fri/Sat is included`):'';
  el.innerHTML=`<b>${formatDate(iso(state.checkIn))} → ${formatDate(iso(state.checkOut))}</b> · ${nights} night${nights!==1?'s':''}${roomWeekendNote}`;
}
function renderSummary(){
  const root=document.getElementById('bookingSummary'), title=document.getElementById('summaryTitle'), btn=document.getElementById('continueButton');
  if(!state.checkIn || !state.checkOut){title.textContent='Start with dates';root.innerHTML='<div class="empty-state"><span class="empty-icon">⌁</span><p>Select dates to see what can be booked.</p></div>';btn.disabled=true;btn.textContent='Choose a stay';return;}
  const restriction=getStayRestriction(state.checkIn,state.checkOut), nights=nightsBetween(state.checkIn,state.checkOut);
  if(nights<restriction.minNights){title.textContent='Adjust your dates';root.innerHTML=`<div class="empty-state"><span class="empty-icon">!</span><p>${restriction.title} requires ${restriction.minNights} nights.</p></div>`;btn.disabled=true;btn.textContent='Choose a stay';return;}
  const available=getAvailableStays();title.textContent=state.selectedStay?state.selectedStay.name:'Dates selected';
  let inner=`<div class="summary-row"><span>Check-in</span><b>${formatDate(iso(state.checkIn))}</b></div><div class="summary-row"><span>Check-out</span><b>${formatDate(iso(state.checkOut))}</b></div><div class="summary-row"><span>Length</span><b>${nights} night${nights!==1?'s':''}</b></div>`;
  if(state.selectedStay){ const price=calculatePrice();inner+=`<div class="summary-row"><span>Stay</span><b>${state.selectedStay.name}</b></div><div class="summary-row"><span>From</span><b>${fmtMoney(price.total)}</b></div>`; }
  else inner+=`<div class="summary-row"><span>Eligible options</span><b>${available.length}</b></div>`;
  root.innerHTML=inner;btn.disabled=false;btn.innerHTML=state.selectedStay?'Continue to details <span>→</span>':'Choose a stay <span>→</span>';
}
function showStays(){
  const options=getAvailableStays(), root=document.getElementById('stayDialogContent'), isWeekend=stayIncludesWeekend(state.checkIn,state.checkOut), nights=nightsBetween(state.checkIn,state.checkOut);
  if (!options.length) {
    root.innerHTML=`<p class="eyebrow">Selected dates</p><h2>Those dates are fully booked.</h2><p class="dialog-subtitle">${formatDate(iso(state.checkIn))} to ${formatDate(iso(state.checkOut))} is not available for a new stay. Please try different dates, or ask us to contact you if something opens up.</p><div class="sold-out-card"><span class="sold-out-mark">⌁</span><div><b>Want us to keep an eye on it?</b><p>In the live site, this would send your dates and group size to the Breathe Woods team by WhatsApp or email — without pretending that a booking is available.</p></div></div><div class="form-actions"><button class="secondary-button" data-change-dates>← Choose different dates</button><button class="primary-button" id="waitlistButton">Ask about a waitlist <span>→</span></button></div>`;
    const dialog=document.getElementById('stayDialog');
    root.querySelector('[data-change-dates]').addEventListener('click',()=>{dialog.close();document.getElementById('calendarTitle').scrollIntoView({behavior:'smooth',block:'center'});});
    root.querySelector('#waitlistButton').addEventListener('click',e=>{e.currentTarget.innerHTML='Waitlist request noted <span>✓</span>';e.currentTarget.disabled=true;});
    dialog.showModal();
    return;
  }
  const blocked=blockedResourcesForStay(state.checkIn,state.checkOut);
  const availabilityMessage=isWeekend?(state.configuration.allowWeekendRooms?'Individual rooms are enabled for all dates in this owner-controlled demo setting.':nights>=WEEKEND_ROOM_MIN_NIGHTS?`This ${nights}-night stay includes Friday or Saturday, so individual rooms and private villas are shown where available.`:`This stay includes Friday or Saturday. Individual rooms need a minimum ${WEEKEND_ROOM_MIN_NIGHTS}-night stay, so private villas are shown.`):'Weekday rooms and private villas are shown only when free for every night.';
  const reasons=Object.entries(villas).map(([key,villa])=>{
    const unavailable=villa.rooms.filter(room=>blocked.has(room));
    if(!unavailable.length) return '';
    const labels=unavailable.map(room=>resources[room].name).join(', ');
    return `<li><b>${villa.name}</b> is not available as a full villa because ${labels} is already booked or blocked.</li>`;
  }).filter(Boolean).join('');
  const remaining=Object.entries(villas).map(([key,villa])=>{
    const count=villa.rooms.filter(room=>!blocked.has(room)).length;
    return count>0 && count<villa.rooms.length?`<li>${count} of ${villa.rooms.length} ${villa.name} room${villa.rooms.length>1?'s':''} remain.</li>`:'';
  }).filter(Boolean).join('');
  root.innerHTML=`<p class="eyebrow">Step 2 of 5</p><h2>Choose your stay</h2><p class="dialog-subtitle">${availabilityMessage}</p>${reasons||remaining?`<div class="availability-context">${reasons?`<b>Why some options are missing</b><ul>${reasons}</ul>`:''}${remaining?`<b>Limited availability</b><ul>${remaining}</ul>`:''}</div>`:''}<div class="stay-options">${options.map(s=>{
    const meta=s.type==='room'?`Individual room · up to ${s.capacity} adults · children currently require a villa`:s.type==='property'?`5 bedrooms · group package for up to ${s.capacity} guests`:`Private villa · up to ${s.capacity} guests · tariff includes up to ${s.includedGuests}`;
    const rate=s.type==='room'?'from ₹4,000/night':s.type==='property'?'all meals included':'from '+fmtMoney(villas[s.villa].rates.breakfast)+'/night';
    return `<button class="stay-option" data-stay-id="${s.id}"><span class="availability">AVAILABLE FOR THIS STAY</span><h3>${s.name}</h3><p>${meta}</p><span class="rate">${rate}</span></button>`;
  }).join('')}</div>`;
  root.querySelectorAll('[data-stay-id]').forEach(btn=>btn.addEventListener('click',()=>{state.selectedStay=options.find(x=>x.id===btn.dataset.stayId);document.getElementById('stayDialog').close();renderAll();openDetails();}));
  document.getElementById('stayDialog').showModal();
}
function openDetails(){
  if(!state.selectedStay){showStays();return;}
  const s=state.selectedStay, room=s.type==='room', nights=nightsBetween(state.checkIn,state.checkOut);
  const petLimit=petLimits[s.type];
  state.pets=Math.min(state.pets,petLimit);
  document.getElementById('detailsDialogContent').innerHTML=`<p class="eyebrow">Step 3 of 5</p><h2>Make it yours</h2><p class="dialog-subtitle">${s.name} · ${formatDate(iso(state.checkIn))} to ${formatDate(iso(state.checkOut))}</p>
  <div class="form-grid">
    <div class="field"><label for="adults">Adults / guests aged 13+</label><input id="adults" min="1" max="${room?2:s.capacity}" type="number" value="${state.adults}"></div>
    <div class="field"><label for="children">Children aged 7–12</label><input id="children" min="0" max="${room?0:9}" type="number" value="${state.children}"></div>
    <div class="field"><label for="toddlers">Children below 7</label><input id="toddlers" min="0" max="${room?0:6}" type="number" value="${state.toddlers}"></div>
    <div class="field"><label for="pets">Pets</label><input id="pets" min="0" max="${petLimit}" type="number" value="${state.pets}"></div>
    <div class="field full"><label for="mealPlan">Meal plan</label><select id="mealPlan">${s.type==='property'?'<option value="allMeals">All meals included for entire property stays</option>':`<option value="breakfast" ${state.mealPlan==='breakfast'?'selected':''}>Breakfast only</option><option value="oneMeal" ${state.mealPlan==='oneMeal'?'selected':''}>Breakfast + lunch or dinner</option><option value="allMeals" ${state.mealPlan==='allMeals'?'selected':''}>All meals — recommended</option>`}</select></div>
    <div class="field full"><label for="dietary">Food preference</label><select id="dietary"><option value="veg" ${state.dietary==='veg'?'selected':''}>Vegetarian</option><option value="nonveg" ${state.dietary==='nonveg'?'selected':''}>Non-vegetarian</option><option value="mixed" ${state.dietary==='mixed'?'selected':''}>Mixed group</option><option value="jain" ${state.dietary==='jain'?'selected':''}>Jain</option><option value="allergy" ${state.dietary==='allergy'?'selected':''}>Allergies / special request</option></select></div>
  </div>
  <div class="occupancy-note" id="occupancyNote"></div>
  <div class="pet-note"><b>Pet stay policy</b><span>Up to ${petLimit} pet${petLimit>1?'s':''} for this stay · ₹2,000 per pet, per night · ₹5,000 refundable deposit once per reservation.</span></div>
  <div class="add-on-list"><div class="add-on"><input id="bbq" type="checkbox" ${state.addOns.bbqSessions>0?'checked':''}><span><b>Bonfire + BBQ</b><small>₹500 per guest, per evening. It applies to the entire party.</small></span><label class="quantity-label">Evenings <input id="bbqSessions" type="number" min="1" max="${nights}" value="${Math.max(1,state.addOns.bbqSessions)}" ${state.addOns.bbqSessions>0?'':'disabled'}></label></div><div class="add-on"><input id="lake" type="checkbox" ${state.addOns.lakeTrips>0?'checked':''}><span><b>Lake trip</b><small>₹500 per car / outing · 4 guests per car (working rule)</small></span><label class="quantity-label">Outings <input id="lakeTrips" type="number" min="1" max="5" value="${Math.max(1,state.addOns.lakeTrips)}" ${state.addOns.lakeTrips>0?'':'disabled'}></label></div></div>
  <div class="live-quote" id="liveQuote"></div>
  <div class="notice">Food choice is captured for the kitchen but does not currently change the tariff. The pet deposit is kept separate from the stay price because it is refundable, subject to the final pet policy.</div>
  <div class="form-actions"><button class="secondary-button" data-back-stays>← Change stay</button><button class="primary-button" id="reviewButton">Review booking <span>→</span></button></div>`;
  const dialog=document.getElementById('detailsDialog');
  const capacity=s.capacity;
  const syncCapacity=()=>{
    const used=state.adults+state.children+state.toddlers;
    const inputs={adults:dialog.querySelector('#adults'),children:dialog.querySelector('#children'),toddlers:dialog.querySelector('#toddlers')};
    inputs.adults.max=Math.max(1,capacity-state.children-state.toddlers);inputs.children.max=Math.max(0,capacity-state.adults-state.toddlers);inputs.toddlers.max=Math.max(0,capacity-state.adults-state.children);
    Object.entries(inputs).forEach(([id,input])=>input.value=state[id]);
    dialog.querySelector('#occupancyNote').innerHTML=`<b>${used} of ${capacity} sleeping places used.</b> Children below 7 are complimentary for the stay tariff, but still count towards the villa’s total overnight capacity.${used===capacity?' No more guests can be added.':''}`;
  };
  const updateQuote=()=>{const price=calculatePrice();dialog.querySelector('#liveQuote').innerHTML=`<span>${price.nights} night${price.nights>1?'s':''} · ${mealLabel(state.mealPlan)}</span><b>${fmtMoney(price.totalWithDeposit)}</b><small>${fmtMoney(price.stayTotal)} stay${price.extras?` + ${fmtMoney(price.extras)} add-ons`:''}${price.refundableDeposit?` + ${fmtMoney(price.refundableDeposit)} refundable pet deposit`:''}</small>`;renderSummary();};
  ['adults','children','toddlers'].forEach(id=>dialog.querySelector('#'+id).addEventListener('input',e=>{const min=id==='adults'?1:0;const others=['adults','children','toddlers'].filter(x=>x!==id).reduce((sum,x)=>sum+state[x],0);state[id]=Math.min(Math.max(min,Number(e.target.value)||0),Math.max(min,capacity-others));syncCapacity();updateQuote()}));
  dialog.querySelector('#pets').addEventListener('input',e=>{state.pets=Math.min(petLimit,Math.max(0,Number(e.target.value)||0));e.target.value=state.pets;updateQuote()});
  dialog.querySelector('#mealPlan').addEventListener('change',e=>{state.mealPlan=e.target.value;updateQuote()});dialog.querySelector('#dietary').addEventListener('change',e=>state.dietary=e.target.value);
  dialog.querySelector('#bbq').addEventListener('change',e=>{state.addOns.bbqSessions=e.target.checked?Math.max(1,state.addOns.bbqSessions):0;dialog.querySelector('#bbqSessions').disabled=!e.target.checked;updateQuote()});
  dialog.querySelector('#lake').addEventListener('change',e=>{state.addOns.lakeTrips=e.target.checked?Math.max(1,state.addOns.lakeTrips):0;dialog.querySelector('#lakeTrips').disabled=!e.target.checked;updateQuote()});
  dialog.querySelector('#bbqSessions').addEventListener('input',e=>{state.addOns.bbqSessions=Math.min(nights,Math.max(1,Number(e.target.value)||1));updateQuote()});
  dialog.querySelector('#lakeTrips').addEventListener('input',e=>{state.addOns.lakeTrips=Math.min(5,Math.max(1,Number(e.target.value)||1));updateQuote()});
  dialog.querySelector('[data-back-stays]').addEventListener('click',()=>{dialog.close();showStays()});dialog.querySelector('#reviewButton').addEventListener('click',()=>{dialog.close();showReview();});dialog.showModal();
  syncCapacity();
  updateQuote();
}
function showReview(){
  const p=calculatePrice(), s=state.selectedStay, guests=state.adults+state.children+state.toddlers;
  const schedule=paymentSchedule();
  document.getElementById('reviewDialogContent').innerHTML=`<p class="eyebrow">Step 4 of 5</p><h2>Review your stay</h2><p class="dialog-subtitle">Check the stay details before adding the lead guest’s contact information.</p>
  <div class="review-card"><div class="summary-row"><span>Stay</span><b>${s.name}</b></div><div class="summary-row"><span>Dates</span><b>${formatDate(iso(state.checkIn))} → ${formatDate(iso(state.checkOut))}</b></div><div class="summary-row"><span>Guests</span><b>${guests} · ${state.pets} pet(s)</b></div><div class="summary-row"><span>Food</span><b>${mealLabel(state.mealPlan)} · ${state.dietary}</b></div><div class="summary-row"><span>Accommodation + meals</span><b>${fmtMoney(p.undiscountedStayTotal)}</b></div>${p.offerDiscount?`<div class="summary-row discount-row"><span>${state.configuration.offer.label}</span><b>−${fmtMoney(p.offerDiscount)}</b></div>`:''}${p.extras?`<div class="summary-row"><span>Experiences + pet stay</span><b>${fmtMoney(p.extras)}</b></div>`:''}${p.labels.map(x=>`<div class="summary-row detail-row"><span>Included / add-on</span><b>${x}</b></div>`).join('')}<div class="summary-row"><span>Refundable pet deposit</span><b>${p.refundableDeposit?fmtMoney(p.refundableDeposit):'—'}</b></div><div class="review-total"><span>${p.refundableDeposit?'Quote incl. deposit':'Demo total'}</span><b>${fmtMoney(p.totalWithDeposit)}</b></div></div>
  <div class="payment-policy-preview"><span>Payment policy in this demo</span><b>${fmtMoney(schedule.dueNow)} due now</b><small>60% advance${p.refundableDeposit?` + ${fmtMoney(p.refundableDeposit)} refundable pet deposit`:''}. Remaining ${fmtMoney(schedule.balance)} due 7 days before arrival.</small></div>
  <div class="notice">This is a transparent quotation preview, not a confirmed reservation. Taxes, deposit-collection/refund timing, room-stay child rules and any holiday-rate override remain configurable once the owner confirms them.</div>
  <div class="form-actions"><button class="secondary-button" data-edit-details>← Edit stay</button><button class="primary-button" id="guestButton">Guest details <span>→</span></button></div>`;
  const dialog=document.getElementById('reviewDialog');dialog.querySelector('[data-edit-details]').addEventListener('click',()=>{dialog.close();openDetails()});dialog.querySelector('#guestButton').addEventListener('click',()=>{dialog.close();showGuestDetails()});dialog.showModal();
}
function showGuestDetails(){
  const g=state.guest;
  const root=document.getElementById('guestDialogContent');
  root.innerHTML=`<p class="eyebrow">Step 5 of 5</p><h2>Who is leading the stay?</h2><p class="dialog-subtitle">We use these details for the booking confirmation, arrival guidance and any important stay updates.</p>
  <form id="guestForm" class="guest-form">
    <div class="form-grid">
      <div class="field full"><label for="guestName">Full name</label><input id="guestName" autocomplete="name" required placeholder="Name of lead guest" value="${g.name}"></div>
      <div class="field"><label for="guestPhone">Mobile / WhatsApp number</label><input id="guestPhone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+91 98xxx xxxxx" value="${g.phone}"></div>
      <div class="field"><label for="guestEmail">Email address</label><input id="guestEmail" type="email" autocomplete="email" required placeholder="you@example.com" value="${g.email}"></div>
      <div class="field"><label for="arrivalTime">Expected arrival</label><select id="arrivalTime"><option value="">Select an approximate time</option>${['11:00 AM–1:00 PM','1:00–3:00 PM','3:00–6:00 PM','After 6:00 PM','Not sure yet'].map(x=>`<option ${g.arrival===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="guestNote">Anything we should know?</label><input id="guestNote" maxlength="160" placeholder="Optional accessibility, food or arrival note" value="${g.note}"></div>
    </div>
    <label class="consent-row"><input id="guestConsent" type="checkbox" ${g.consent?'checked':''} required> <span>I agree to receive booking and stay updates by WhatsApp and email.</span></label>
    <p class="privacy-note">Demo privacy note: this prototype does not save or send the information you enter.</p>
    <div class="form-actions"><button type="button" class="secondary-button" data-back-review>← Review stay</button><button class="primary-button" type="submit">Continue to payment <span>→</span></button></div>
  </form>`;
  const dialog=document.getElementById('guestDialog');
  root.querySelector('[data-back-review]').addEventListener('click',()=>{dialog.close();showReview()});
  root.querySelector('#guestForm').addEventListener('submit',e=>{
    e.preventDefault();
    state.guest={name:root.querySelector('#guestName').value.trim(),phone:root.querySelector('#guestPhone').value.trim(),email:root.querySelector('#guestEmail').value.trim(),arrival:root.querySelector('#arrivalTime').value,note:root.querySelector('#guestNote').value.trim(),consent:root.querySelector('#guestConsent').checked};
    dialog.close();showPayment();
  });
  dialog.showModal();
}
function showPayment(){
  const p=calculatePrice(), schedule=paymentSchedule(), s=state.selectedStay;
  const root=document.getElementById('paymentDialogContent');
  root.innerHTML=`<div class="payment-brand"><span class="razor-mark">R</span><span><b>Razorpay</b><small>Secure checkout · simulated</small></span></div>
  <p class="eyebrow">Payment for Breathe Woods</p><h2>Confirm your booking</h2>
  <div class="payment-order"><div><span>${s.name}</span><small>${formatDate(iso(state.checkIn))} → ${formatDate(iso(state.checkOut))} · ${state.guest.name}</small></div><b>${fmtMoney(schedule.dueNow)}</b></div>
  <div class="payment-breakdown"><div><span>60% booking advance</span><b>${fmtMoney(schedule.stayAdvance)}</b></div>${schedule.refundableDeposit?`<div><span>Refundable pet deposit</span><b>${fmtMoney(schedule.refundableDeposit)}</b></div>`:''}<div class="balance-line"><span>Balance due 7 days before arrival</span><b>${fmtMoney(schedule.balance)}</b></div></div>
  <p class="payment-prompt">Choose a payment method</p>
  <div class="payment-methods">
    <button class="payment-method ${state.paymentMethod==='upi'?'selected':''}" data-method="upi"><span class="method-icon">⌁</span><span><b>UPI</b><small>Google Pay, PhonePe, Paytm and more</small></span><i>›</i></button>
    <button class="payment-method ${state.paymentMethod==='card'?'selected':''}" data-method="card"><span class="method-icon">▣</span><span><b>Credit / debit card</b><small>Visa, Mastercard, RuPay and more</small></span><i>›</i></button>
    <button class="payment-method ${state.paymentMethod==='netbanking'?'selected':''}" data-method="netbanking"><span class="method-icon">⌂</span><span><b>Netbanking</b><small>Pay securely through your bank</small></span><i>›</i></button>
  </div>
  <div class="secure-handoff"><span>🔒</span><span><b>Protected payment handoff</b><small>In the live site, Razorpay’s hosted checkout securely collects payment details. Breathe Woods never receives card or UPI credentials.</small></span></div>
  <button id="simulatePayButton" class="primary-button payment-button">Simulate ${state.paymentMethod.toUpperCase()} payment <span>→</span></button>
  <p class="payment-disclaimer">Prototype only. Do not enter a real UPI ID, card number or bank details.</p>`;
  const dialog=document.getElementById('paymentDialog');
  root.querySelectorAll('[data-method]').forEach(btn=>btn.addEventListener('click',()=>{state.paymentMethod=btn.dataset.method;showPayment()}));
  root.querySelector('#simulatePayButton').addEventListener('click',()=>{
    root.innerHTML=`<div class="payment-success"><span>✓</span><p class="eyebrow">Simulation complete</p><h2>Your Breathe Woods stay is confirmed.</h2><p>${fmtMoney(schedule.dueNow)} would be marked paid, the booking would be confirmed, and ${fmtMoney(schedule.balance)} would be scheduled for collection 7 days before arrival.</p><div class="review-card"><div class="summary-row"><span>Guest</span><b>${state.guest.name}</b></div><div class="summary-row"><span>Confirmation channel</span><b>WhatsApp + email</b></div><div class="summary-row"><span>Payment reference</span><b>demo_${Date.now().toString().slice(-6)}</b></div></div><div class="arrival-preview"><b>What the guest receives next</b><span>Booking confirmation · directions · check-in guidance · meal and pet notes · a WhatsApp link for help</span></div><div class="confirmation-actions"><button class="secondary-button" id="whatsappPreview">Preview WhatsApp</button><button class="primary-button" id="finishDemo">Done <span>✓</span></button></div></div>`;
    root.querySelector('#whatsappPreview').addEventListener('click',e=>{e.currentTarget.textContent='WhatsApp preview prepared ✓';e.currentTarget.disabled=true;});
    root.querySelector('#finishDemo').addEventListener('click',()=>dialog.close());
  });
  dialog.showModal();
}
function openMessageHost(){
  const root=document.getElementById('messageHostDialogContent');
  const selectedDates=state.checkIn&&state.checkOut?`${iso(state.checkIn)} to ${iso(state.checkOut)}`:'';
  root.innerHTML=`<p class="eyebrow">Talk to Breathe Woods</p><h2>How can we help?</h2><p class="dialog-subtitle">Ask a question, discuss a special stay, or let us know what you need. There is no obligation to book.</p>
  <form id="hostMessageForm" class="guest-form">
    <div class="form-grid">
      <div class="field full"><label for="hostName">Your name</label><input id="hostName" required autocomplete="name" placeholder="Your full name" value="${state.guest.name}"></div>
      <div class="field"><label for="hostEmail">Email address</label><input id="hostEmail" required type="email" autocomplete="email" placeholder="you@example.com" value="${state.guest.email}"></div>
      <div class="field"><label for="hostPhone">Mobile / WhatsApp</label><input id="hostPhone" required type="tel" inputmode="tel" autocomplete="tel" placeholder="+91 98xxx xxxxx" value="${state.guest.phone}"></div>
      <div class="field"><label for="hostCheckIn">Check-in</label><input id="hostCheckIn" type="date" value="${state.checkIn?iso(state.checkIn):''}"></div>
      <div class="field"><label for="hostCheckOut">Check-out</label><input id="hostCheckOut" type="date" value="${state.checkOut?iso(state.checkOut):''}"></div>
      <div class="field full"><label for="hostType">What is this about?</label><select id="hostType"><option value="General question">General question</option><option value="Special group or 16+ guests">Special group or 16+ guests</option><option value="Food, Jain or dietary request">Food, Jain or dietary request</option><option value="Pet stay">Pet stay</option><option value="Accessibility or arrival support">Accessibility or arrival support</option><option value="Offer or discount request">Offer or discount request</option><option value="Other special request">Other special request</option></select></div>
      <div class="field full"><label for="hostMessage">Your message</label><textarea id="hostMessage" required maxlength="1500" placeholder="Tell us what you have in mind…"></textarea></div>
    </div>
    <p class="privacy-note">Your message is sent securely to Breathe Woods. The host can reply directly to the email address you provide.</p>
    <div class="form-actions"><button type="button" class="secondary-button" data-close-host>Cancel</button><button class="primary-button" type="submit">Send message <span>→</span></button></div>
  </form>`;
  const dialog=document.getElementById('messageHostDialog');
  root.querySelector('[data-close-host]').addEventListener('click',()=>dialog.close());
  root.querySelector('#hostMessageForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const details={name:root.querySelector('#hostName').value.trim(),email:root.querySelector('#hostEmail').value.trim(),phone:root.querySelector('#hostPhone').value.trim(),checkIn:root.querySelector('#hostCheckIn').value,checkOut:root.querySelector('#hostCheckOut').value,type:root.querySelector('#hostType').value,message:root.querySelector('#hostMessage').value.trim()};
    const submitButton=root.querySelector('button[type="submit"]');
    submitButton.disabled=true;submitButton.innerHTML='Sending… <span>•</span>';
    try {
      const data=new URLSearchParams({'form-name':'message-host','bot-field':'','Guest name':details.name,'Guest email':details.email,'Guest mobile / WhatsApp':details.phone,'Requested check-in':details.checkIn || 'Not provided','Requested check-out':details.checkOut || 'Not provided','Enquiry type':details.type,'Guest message':details.message,Source:'Breathe Woods booking prototype'});
      const local=['localhost','127.0.0.1'].includes(window.location.hostname);
      if(!local){
        const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data.toString()});
        if(!response.ok) throw new Error('Unable to submit the message');
      }
      root.innerHTML=`<div class="message-sent"><span>✓</span><p class="eyebrow">Message sent</p><h2>Thank you — Breathe Woods will be in touch.</h2><p>${local?`This local prototype has validated the form flow. When deployed to Netlify, the same submission will be captured automatically and sent to ${HOST_MESSAGE_TEST_RECIPIENT} as the initial host notification.`:'Your enquiry has been sent to the Breathe Woods team. They can reply directly to the email address you provided.'}</p><button class="primary-button" id="closeHostConfirmation">Done <span>✓</span></button></div>`;
      root.querySelector('#closeHostConfirmation').addEventListener('click',()=>dialog.close());
    } catch (error) {
      submitButton.disabled=false;submitButton.innerHTML='Send message <span>→</span>';
      const note=document.createElement('p');note.className='form-error';note.textContent='We could not send your message. Please try again or contact us by WhatsApp.';root.querySelector('#hostMessageForm').appendChild(note);
    }
  });
  dialog.showModal();
}
function renderScenarios(){
  const root=document.getElementById('scenarioList');
  root.innerHTML=scenarios.map(s=>`<button class="scenario" data-start="${s.start}" data-end="${s.end}"><strong>${s.label}</strong><small>${s.text}</small><em>Try this stay →</em></button>`).join('');
  root.querySelectorAll('[data-start]').forEach(button=>button.addEventListener('click',()=>{
    state.checkIn=fromIso(button.dataset.start);state.checkOut=fromIso(button.dataset.end);state.selectedStay=null;state.visibleMonth=new Date(state.checkIn.getFullYear(),state.checkIn.getMonth(),1);renderAll();document.querySelector('.booking-workspace').scrollIntoView({behavior:'smooth',block:'start'});
  }));
}
function renderAll(){renderCalendar();renderDateSummary();renderSummary();}
function setOwnerStatus(message){ document.getElementById('ownerControlStatus').textContent=message; }
function resourceListForBlock(key){
  if(key==='property') return Object.keys(resources);
  if(key==='zen' || key==='boug') return villas[key].rooms;
  return [key];
}
function initialiseOwnerControls(){
  const byId=id=>document.getElementById(id);
  const defaultStart='2026-10-20', defaultEnd='2026-10-24';
  ['offerStart','holidayStart','blockStart'].forEach(id=>byId(id).value=defaultStart);
  ['offerEnd','holidayEnd','blockEnd'].forEach(id=>byId(id).value=defaultEnd);
  byId('weekendRoomToggle').addEventListener('change',e=>{
    state.configuration.allowWeekendRooms=e.target.checked;
    byId('weekendPolicyHelp').textContent=e.target.checked?'Rooms are currently available on every date, subject to inventory.':'Rooms need a 4-night stay when Friday or Saturday is included.';
    setOwnerStatus(e.target.checked?'Weekend rooms enabled for all dates.':'Four-night Friday/Saturday room rule restored.');renderAll();
  });
  byId('zenBreakfastRate').addEventListener('change',e=>{villas.zen.rates.breakfast=Math.max(0,Number(e.target.value)||0);setOwnerStatus(`Zen breakfast tariff set to ${fmtMoney(villas.zen.rates.breakfast)} per night.`);renderAll();});
  byId('bougBreakfastRate').addEventListener('change',e=>{villas.boug.rates.breakfast=Math.max(0,Number(e.target.value)||0);setOwnerStatus(`Bougan’villa breakfast tariff set to ${fmtMoney(villas.boug.rates.breakfast)} per night.`);renderAll();});
  byId('applyOffer').addEventListener('click',()=>{
    const start=byId('offerStart').value,end=byId('offerEnd').value,percent=Math.min(100,Math.max(0,Number(byId('offerPercent').value)||0));
    if(!start || !end || fromIso(end)<=fromIso(start) || !percent){setOwnerStatus('Enter valid offer dates and a discount percentage.');return;}
    state.configuration.offer={start,end,percent,label:byId('offerLabel').value.trim()||'Limited-time offer'};setOwnerStatus(`${state.configuration.offer.label} is active for selected stay nights.`);renderAll();
  });
  byId('clearOffer').addEventListener('click',()=>{state.configuration.offer=null;setOwnerStatus('Date-specific offer cleared.');renderAll();});
  byId('applyHoliday').addEventListener('click',()=>{
    const start=byId('holidayStart').value,end=byId('holidayEnd').value;
    if(!start || !end || fromIso(end)<=fromIso(start)){setOwnerStatus('Enter a valid holiday date window.');return;}
    state.configuration.customHolidayWindows.push({start,end,title:'Owner-set holiday period',minNights:2});setOwnerStatus('Two-night holiday minimum added for the selected dates.');renderAll();
  });
  byId('applyBlock').addEventListener('click',()=>{
    const start=byId('blockStart').value,end=byId('blockEnd').value,key=byId('blockResource').value;
    if(!start || !end || fromIso(end)<=fromIso(start)){setOwnerStatus('Enter a valid inventory block window.');return;}
    state.configuration.customBlocks.push({id:`DEMO-BLOCK-${Date.now()}`,guest:'Owner demo block',start,end,resources:resourceListForBlock(key),kind:'owner-block',note:'Added through owner demo controls'});
    setOwnerStatus(`${byId('blockResource').options[byId('blockResource').selectedIndex].text} is now owner-blocked for the selected dates.`);renderAll();
  });
}

document.getElementById('continueButton').addEventListener('click',()=>state.selectedStay?openDetails():showStays());
document.getElementById('messageHostButton').addEventListener('click',openMessageHost);
document.getElementById('openLegend').addEventListener('click',()=>document.getElementById('availabilityDialog').showModal());
document.getElementById('closeLegend').addEventListener('click',()=>document.getElementById('availabilityDialog').close());
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.getElementById('previousMonth').addEventListener('click',()=>{state.visibleMonth=new Date(state.visibleMonth.getFullYear(),state.visibleMonth.getMonth()-1,1);renderCalendar();});
document.getElementById('nextMonth').addEventListener('click',()=>{state.visibleMonth=new Date(state.visibleMonth.getFullYear(),state.visibleMonth.getMonth()+1,1);renderCalendar();});
document.getElementById('resetDemo').addEventListener('click',()=>{Object.assign(state,{visibleMonth:new Date(startMonth),checkIn:null,checkOut:null,selectedStay:null,adults:2,children:0,toddlers:0,pets:0,mealPlan:'allMeals',dietary:'mixed',addOns:{bbqSessions:0,lakeTrips:0},guest:{name:'',phone:'',email:'',arrival:'',note:'',consent:false},paymentMethod:'upi',configuration:{allowWeekendRooms:false,offer:null,customHolidayWindows:[],customBlocks:[]}});villas.zen.rates.breakfast=17000;villas.boug.rates.breakfast=26000;renderAll();window.scrollTo({top:0,behavior:'smooth'})});
initialiseOwnerControls();renderScenarios();renderAll();
