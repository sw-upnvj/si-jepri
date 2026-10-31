const API_URL = 'https://script.google.com/macros/s/AKfycbzk4xCE1UYQeLkQF6r1kso0ZX4mkifi_TD-lrcQnb3Rcphu8WQKt1VLY6coxvAzOLA2/exec';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedLecturerEmail = '';
let selectedDate = '';
let selectedStartTime = '';
let selectedEndTime = '';
let allTimes = [];
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

window.onload = function() {
    // 1. Load Dosen
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getLecturers' })
    })
    .then(res => res.json())
    .then(response => {
        const select = document.getElementById('lecturerSelect');
        select.innerHTML = '<option value="">-- Pilih Dosen --</option>';
        if (response.success && response.data) {
            response.data.forEach(dosen => {
                const option = document.createElement('option');
                option.value = dosen.email;
                option.textContent = dosen.nama;
                select.appendChild(option);
            });
        }
    })
    .catch(err => console.error("Error Load Dosen:", err));

    // 2. Load List Jam
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getTimeSlots' })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success && response.data) {
            allTimes = response.data;
            const startSelect = document.getElementById('startTimeSelect');
            const endSelect = document.getElementById('endTimeSelect');
            allTimes.forEach(time => {
                startSelect.innerHTML += `<option value="${time}">${time}</option>`;
                endSelect.innerHTML += `<option value="${time}">${time}</option>`;
            });
            startSelect.addEventListener('change', calculateDuration);
            endSelect.addEventListener('change', calculateDuration);
        }
    })
    .catch(err => console.error("Error Load Jam:", err));
};

function resetCalendar() {
    selectedLecturerEmail = document.getElementById('lecturerSelect').value;
    const calSection = document.getElementById('calendarSection');
    if (selectedLecturerEmail) {
        calSection.style.display = 'block';
        calSection.classList.remove('disabled-style');
        calSection.querySelectorAll('button').forEach(btn => btn.disabled = false);
        renderCalendar();
    } else {
        calSection.style.display = 'none';
        calSection.classList.add('disabled-style');
    }
    document.getElementById('timeSection').style.display = 'none';
    document.getElementById('dynamicFormSection').classList.add('hidden');
    document.getElementById('studentForm').classList.add('hidden');
}

function changeMonth(dir) {
    currentMonth += dir;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    document.getElementById('monthYearLabel').textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // URUTAN HARI DIMULAI DARI MINGGU
    ['M', 'S', 'S', 'R', 'K', 'J', 'S'].forEach(d => {
        const el = document.createElement('div'); 
        el.className = 'cal-dow'; 
        el.textContent = d; 
        grid.appendChild(el);
    });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Minggu
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    // Buat kotak kosong sebelum tanggal 1
    for (let i = 0; i < firstDay; i++) {
        const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentYear, currentMonth, day);
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = dateObj.getDay();

        const box = document.createElement('div');
        box.className = 'cal-day';
        box.textContent = day;

        // 0 = Minggu (Merah), 6 = Sabtu (Abu-abu)
        if (dayOfWeek === 0) {
            box.classList.add('disabled-red'); box.title = "Hari Minggu (Libur)";
        } else if (dayOfWeek === 6) {
            box.classList.add('disabled-gray'); box.title = "Hari Sabtu (Libur)";
        } else if (dateObj < today) {
            box.classList.add('disabled'); box.title = "Tanggal sudah lewat";
        } else {
            box.classList.add('full'); box.style.opacity = '0.5'; box.style.cursor = 'wait';
            box.id = `day-${dateStr}`;

            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'getBookedTimes', lecturerEmail: selectedLecturerEmail, date: dateStr })
            })
            .then(res => res.json())
            .then(response => {
                const bookedSlots = response.data || [];
                let availableCount = 0;
                
                allTimes.forEach(time => {
                    let isBooked = false;
                    bookedSlots.forEach(slot => {
                        let sFix = slot.start.trim(); if (sFix.length === 4) sFix = '0' + sFix;
                        let eFix = slot.end.trim(); if (eFix.length === 4) eFix = '0' + eFix;
                        if (time >= sFix && time < eFix) isBooked = true;
                    });
                    if (!isBooked) availableCount++;
                });

                const el = document.getElementById(`day-${dateStr}`);
                if (el) {
                    el.style.opacity = '1'; el.style.cursor = 'pointer';
                    if (bookedSlots.length === 0 && availableCount > 0) {
                        el.className = 'cal-day green'; el.title = "Dosen kosong seharian"; el.onclick = () => selectDate(dateStr, el);
                    } else if (bookedSlots.length > 0 && availableCount > 0) {
                        el.className = 'cal-day orange'; el.title = "Dosen ada jadwal, tapi masih ada jam kosong"; el.onclick = () => selectDate(dateStr, el);
                    } else {
                        el.className = 'cal-day full'; el.title = "Jadwal penuh";
                    }
                }
            });
        }
        grid.appendChild(box);
    }
}

function selectDate(dateStr, el) {
    document.querySelectorAll('.cal-day.selected').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    selectedDate = dateStr;
    document.getElementById('dateInput').value = dateStr;
    document.getElementById('timeSection').style.display = 'block';
    document.getElementById('dynamicFormSection').classList.remove('hidden');
    document.getElementById('studentForm').classList.remove('hidden');
    loadDropdownTimes(dateStr);
}

function loadDropdownTimes(dateVal) {
    const startSelect = document.getElementById('startTimeSelect');
    const endSelect = document.getElementById('endTimeSelect');
    const busyInfo = document.getElementById('busyScheduleInfo');
    const busyList = document.getElementById('busyList');
    startSelect.value = ""; endSelect.value = "";
    document.getElementById('durationInfo').style.display = 'none';
    busyInfo.style.display = 'none'; busyList.innerHTML = '';
    startSelect.options[0].text = "⏳ Memuat..."; endSelect.options[0].text = "⏳ Memuat...";

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getBookedTimes', lecturerEmail: selectedLecturerEmail, date: dateVal })
    })
    .then(res => res.json())
    .then(response => {
        startSelect.options[0].text = "-- Pilih --"; endSelect.options[0].text = "-- Pilih --";
        const bookedSlots = response.data || [];
        if (bookedSlots.length > 0) {
            busyInfo.style.display = 'block';
            bookedSlots.forEach(slot => { busyList.innerHTML += `<li>${slot.start} - ${slot.end}</li>`; });
        }
        allTimes.forEach(time => {
            let isBooked = false;
            bookedSlots.forEach(slot => {
                let sFix = slot.start.trim(); if (sFix.length === 4) sFix = '0' + sFix;
                let eFix = slot.end.trim(); if (eFix.length === 4) eFix = '0' + eFix;
                if (time >= sFix && time < eFix) isBooked = true;
            });

            const optStart = Array.from(startSelect.options).find(o => o.value === time);
            if (optStart) { optStart.disabled = isBooked; optStart.text = time + (isBooked ? " (Terisi)" : ""); }
            const optEnd = Array.from(endSelect.options).find(o => o.value === time);
            if (optEnd) { optEnd.disabled = isBooked; optEnd.text = time + (isBooked ? " (Terisi)" : ""); }
        });
    })
    .catch(err => { startSelect.options[0].text = "-- Gagal --"; endSelect.options[0].text = "-- Gagal --"; });
}

function calculateDuration() {
    hideMessage();
    const startTime = document.getElementById('startTimeSelect').value;
    const endTime = document.getElementById('endTimeSelect').value;
    const durationInfo = document.getElementById('durationInfo');
    if (startTime && endTime) {
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        const duration = (eH * 60 + eM) - (sH * 60 + sM);
        if (duration <= 0) {
            durationInfo.textContent = '⚠️ Jam selesai harus lebih besar dari jam mulai';
            durationInfo.style.background = '#f8d7da'; durationInfo.style.color = '#721c24'; durationInfo.style.borderLeftColor = '#dc3545';
        } else {
            const h = Math.floor(duration / 60); const m = duration % 60;
            durationInfo.textContent = '⏱️ Durasi: ' + (h > 0 ? `${h} jam ` : '') + (m > 0 ? `${m} menit` : '');
            durationInfo.style.background = '#d4edda'; durationInfo.style.color = '#155724'; durationInfo.style.borderLeftColor = '#28a745';
        }
        durationInfo.style.display = 'block';
    } else { durationInfo.style.display = 'none'; }
}

function changeAgendaForm() {
    const agenda = document.getElementById('agendaType').value;
    document.getElementById('formKuliah').classList.add('hidden');
    document.getElementById('formBimbingan').classList.add('hidden');
    document.getElementById('formRapat').classList.add('hidden');
    if (agenda === 'Penjadwalan Kuliah') document.getElementById('formKuliah').classList.remove('hidden');
    else if (agenda === 'Bimbingan/ Ujian/ Responsi') document.getElementById('formBimbingan').classList.remove('hidden');
    else document.getElementById('formRapat').classList.remove('hidden');
}

function submitBooking() {
    selectedStartTime = document.getElementById('startTimeSelect').value;
    selectedEndTime = document.getElementById('endTimeSelect').value;
    if (!selectedStartTime || !selectedEndTime) return showMessage('Harap pilih jam mulai dan jam selesai.', 'error');
    
    const [sH, sM] = selectedStartTime.split(':').map(Number);
    const [eH, eM] = selectedEndTime.split(':').map(Number);
    if ((eH * 60 + eM) <= (sH * 60 + sM)) return showMessage('Jam selesai harus lebih besar dari jam mulai.', 'error');

    const agendaType = document.getElementById('agendaType').value;
    let detail1 = ''; let detail2 = '';

    if (agendaType === 'Penjadwalan Kuliah') {
        detail1 = document.getElementById('detail1_kuliah').value; 
        let pertemuan = document.getElementById('pertemuan_kuliah').value;
        let materi = document.getElementById('materi_kuliah').value;
        let ruang = document.getElementById('detail2_kuliah').value;
        if (!detail1 || !pertemuan || !materi || !ruang) return showMessage('Lengkapi Mata Kuliah, Pertemuan, Materi, dan Ruang.', 'error');
        detail2 = `Pertemuan: ${pertemuan} | Materi: ${materi} | Ruang: ${ruang}`;
    } else if (agendaType === 'Bimbingan/ Ujian/ Responsi') {
        detail1 = document.getElementById('detail1_bimbingan').value;
        detail2 = document.getElementById('detail2_bimbingan').value || '-';
        if (!detail1) return showMessage('Lengkapi Keterangan.', 'error');
    } else {
        detail1 = document.getElementById('detail1_rapat').value;
        detail2 = document.getElementById('detail2_rapat').value || '-';
        if (!detail1) return showMessage('Lengkapi Perihal Rapat.', 'error');
    }

    const studentName = document.getElementById('studentName').value;
    const studentEmail = document.getElementById('studentEmail').value;
    if (!studentName || !studentEmail) return showMessage('Lengkapi Nama dan Email Mahasiswa.', 'error');
    
    showMessage('⏳ Mengirim pengajuan...', 'loading');

    const bookingData = {
        lecturerEmail: selectedLecturerEmail, studentName, studentEmail, 
        date: selectedDate, startTime: selectedStartTime, endTime: selectedEndTime, 
        agendaType, detail1, detail2
    };

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'submitBooking', bookingData })
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            showMessage('✅ ' + response.message, 'success');
            document.getElementById('studentForm').classList.add('hidden');
            document.getElementById('studentName').value = '';
            document.getElementById('studentEmail').value = '';
            document.getElementById('timeSection').style.display = 'none';
            document.getElementById('dynamicFormSection').classList.add('hidden');
            renderCalendar(); 
        } else {
            showMessage('❌ ' + response.message, 'error');
        }
    })
    .catch(err => showMessage('❌ Kesalahan koneksi.', 'error'));
}

function showMessage(text, type) {
    const box = document.getElementById('messageBox');
    box.textContent = text; 
    box.className = 'toast ' + type; 
}
function hideMessage() { 
    document.getElementById('messageBox').className = 'toast hidden'; 
}