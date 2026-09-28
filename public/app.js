let allWarranties = [];

document.addEventListener('DOMContentLoaded', () => {
  // Set default purchase date to today
  const todayStr = new Date().toISOString().split('T')[0];
  const purchaseDateInput = document.getElementById('purchaseDateInput');
  if (purchaseDateInput) purchaseDateInput.value = todayStr;

  loadWarranties();

  document.getElementById('addForm').addEventListener('submit', handleAddWarranty);
  document.getElementById('searchInput').addEventListener('input', filterAndRender);
  document.getElementById('statusFilter').addEventListener('change', filterAndRender);
});

async function loadWarranties() {
  try {
    const res = await fetch('/api/warranties');
    const data = await res.json();
    allWarranties = data.warranties || [];
    filterAndRender();
  } catch (err) {
    console.error('Failed to load warranties:', err);
  }
}

function calculateStatus(expiryDateStr) {
  const now = new Date();
  now.setHours(0,0,0,0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0,0,0,0);

  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'expired', label: 'Đã hết hạn', class: 'bg-danger' };
  } else if (diffDays <= 30) {
    return { status: 'warning', label: `Sắp hết hạn (${diffDays} ngày)`, class: 'bg-warning text-dark' };
  } else {
    return { status: 'active', label: 'Còn hạn', class: 'bg-success' };
  }
}

function filterAndRender() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  let total = allWarranties.length;
  let warningCount = 0;
  let expiredCount = 0;

  const filtered = allWarranties.filter(item => {
    const statusObj = calculateStatus(item.expiry_date);
    if (statusObj.status === 'warning') warningCount++;
    if (statusObj.status === 'expired') expiredCount++;

    const matchesSearch = item.name.toLowerCase().includes(search) ||
                          (item.category && item.category.toLowerCase().includes(search)) ||
                          (item.notes && item.notes.toLowerCase().includes(search));

    const matchesStatus = statusFilter === 'all' || statusObj.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  document.getElementById('statTotal').innerText = total;
  document.getElementById('statWarning').innerText = warningCount;
  document.getElementById('statExpired').innerText = expiredCount;

  const tbody = document.getElementById('warrantyTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Không tìm thấy sản phẩm bảo hành nào</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const st = calculateStatus(item.expiry_date);
    const imgBtn = item.invoice_image 
      ? `<button class="btn btn-sm btn-outline-primary" onclick="showImage('${item.invoice_image}')"><i class="bi bi-image"></i> Xem</button>`
      : `<span class="text-muted small">Không có</span>`;

    return `
      <tr>
        <td class="ps-3">
          <div class="fw-bold text-dark">${escapeHtml(item.name)}</div>
          ${item.notes ? `<small class="text-muted">${escapeHtml(item.notes)}</small>` : ''}
        </td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(item.category || 'General')}</span></td>
        <td>${item.purchase_date}</td>
        <td class="fw-semibold">${item.expiry_date}</td>
        <td><span class="badge ${st.class}">${st.label}</span></td>
        <td>${imgBtn}</td>
        <td class="text-end pe-3">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteWarranty(${item.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleAddWarranty(e) {
  e.preventDefault();
  const form = document.getElementById('addForm');
  const formData = new FormData(form);
  const saveBtn = document.getElementById('saveBtn');
  
  saveBtn.disabled = true;
  saveBtn.innerText = 'Đang lưu...';

  try {
    const res = await fetch('/api/warranties', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (res.ok) {
      form.reset();
      const todayStr = new Date().toISOString().split('T')[0];
      document.getElementById('purchaseDateInput').value = todayStr;
      bootstrap.Modal.getInstance(document.getElementById('addModal')).hide();
      loadWarranties();
    } else {
      alert('Lỗi: ' + (result.error || 'Không thể lưu sản phẩm'));
    }
  } catch (err) {
    console.error(err);
    alert('Đã xảy ra lỗi kết nối');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = 'Lưu sản phẩm';
  }
}

async function deleteWarranty(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm bảo hành này?')) return;
  try {
    const res = await fetch(`/api/warranties/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadWarranties();
    } else {
      alert('Không thể xóa sản phẩm');
    }
  } catch (err) {
    console.error(err);
  }
}

function showImage(url) {
  document.getElementById('previewImg').src = url;
  new bootstrap.Modal(document.getElementById('imageModal')).show();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
