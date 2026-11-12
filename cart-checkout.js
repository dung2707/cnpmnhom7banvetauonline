// ============================================================================
// THÀNH VIÊN 3: GIỎ VÉ, TÍNH GIÁ ĐỘNG THEO ĐỐI TƯỢNG, VOUCHER & VALIDATE FORM
// ============================================================================

window.VietRail = window.VietRail || {};

VietRail.PASSENGER_DISCOUNTS = {
  "Người lớn": 0,
  "Sinh viên": 0.10,        // Giảm 10%
  "Người cao tuổi": 0.15,   // Giảm 15%
  "Trẻ em": 0.25            // Giảm 25%
};

VietRail.calculateItemPrice = function (item) {
  const discount = VietRail.PASSENGER_DISCOUNTS[item.passengerType] || 0;
  return Math.round(item.baseSeatPrice * (1 - discount));
};

VietRail.renderCart = function () {
  const cartEl = document.getElementById("cart-items");
  const cart = VietRail.state.cart;
  document.getElementById("cart-count-badge").textContent = `${cart.length} ghế`;

  if (cart.length === 0) {
    cartEl.innerHTML = `<p style="color:#64748b;font-size:13px;">Chưa có ghế nào được chọn. Hãy click vào ghế trống trên sơ đồ toa tàu.</p>`;
  } else {
    cartEl.innerHTML = cart.map((item, idx) => {
      const price = VietRail.calculateItemPrice(item);
      return `
        <div class="cart-item">
          <div>
            <strong>Tàu ${item.trainId} - Ghế ${item.seatCode}</strong><br>
            <span>${VietRail.formatCurrency(price)}</span>
          </div>
          <select onchange="VietRail.changePassengerType(${idx}, this.value)">
            ${Object.keys(VietRail.PASSENGER_DISCOUNTS).map(type =>
              `<option value="${type}" ${item.passengerType === type ? "selected" : ""}>${type}</option>`
            ).join("")}
          </select>
          <button class="btn-danger" onclick="VietRail.removeCartItem(${idx})">✕</button>
        </div>
      `;
    }).join("");
  }

  // Tính tổng tiền & Voucher
  const subtotal = cart.reduce((sum, item) => sum + VietRail.calculateItemPrice(item), 0);
  const voucherDiscount = Math.round(subtotal * VietRail.state.voucherDiscountRate);
  const finalTotal = Math.max(0, subtotal - voucherDiscount);

  document.getElementById("subtotal-price").textContent = VietRail.formatCurrency(subtotal);
  document.getElementById("discount-price").textContent = "-" + VietRail.formatCurrency(voucherDiscount);
  document.getElementById("total-price").textContent = VietRail.formatCurrency(finalTotal);
};

VietRail.changePassengerType = function (index, newType) {
  VietRail.state.cart[index].passengerType = newType;
  VietRail.renderCart();
};

VietRail.removeCartItem = function (index) {
  VietRail.state.cart.splice(index, 1);
  if (VietRail.state.cart.length === 0) VietRail.stopHoldTimer();
  VietRail.renderSeatMap();
  VietRail.renderCart();
};

// Áp mã Voucher khuyến mãi
VietRail.applyVoucher = function () {
  const code = document.getElementById("voucher-input").value.trim().toUpperCase();
  const msgEl = document.getElementById("voucher-msg");

  if (code === "VIETRAIL10") {
    VietRail.state.voucherDiscountRate = 0.10;
    msgEl.style.color = "#16a34a";
    msgEl.textContent = "✔ Áp dụng thành công mã VIETRAIL10 (-10% tổng hóa đơn)";
  } else if (code === "SINHVIEN50") {
    VietRail.state.voucherDiscountRate = 0.15;
    msgEl.style.color = "#16a34a";
    msgEl.textContent = "✔ Áp dụng mã SINHVIEN50 (-15% ưu đãi học kỳ)";
  } else {
    VietRail.state.voucherDiscountRate = 0;
    msgEl.style.color = "#dc2626";
    msgEl.textContent = "✖ Mã giảm giá không hợp lệ!";
  }
  VietRail.renderCart();
};

// Validate Form & Xử lý Đặt vé
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("checkout-form").addEventListener("submit", function (e) {
    e.preventDefault();

    if (VietRail.state.cart.length === 0) {
      VietRail.showToast("Vui lòng chọn ít nhất 1 ghế trên sơ đồ trước khi đặt vé!", "error");
      return;
    }

    const name = document.getElementById("cust-name").value.trim();
    const cccd = document.getElementById("cust-cccd").value.trim();
    const phone = document.getElementById("cust-phone").value.trim();
    const email = document.getElementById("cust-email").value.trim();

    let isValid = true;
    document.querySelectorAll(".field-error").forEach(el => el.textContent = "");

    if (name.length < 3) {
      document.getElementById("err-name").textContent = "Họ tên phải có ít nhất 3 ký tự.";
      isValid = false;
    }
    if (!/^\d{12}$/.test(cccd)) {
      document.getElementById("err-cccd").textContent = "CCCD phải gồm đúng 12 chữ số.";
      isValid = false;
    }
    if (!/^0\d{9}$/.test(phone)) {
      document.getElementById("err-phone").textContent = "SĐT phải gồm 10 chữ số và bắt đầu bằng số 0.";
      isValid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById("err-email").textContent = "Email không đúng định dạng.";
      isValid = false;
    }

    if (!isValid) return;

    // Lưu từng ghế thành vé vào danh sách Bookings & khóa ghế trên tàu
    VietRail.state.cart.forEach(item => {
      const train = VietRail.state.trains.find(t => t.id === item.trainId);
      if (train && !train.bookedSeats.includes(item.seatCode)) {
        train.bookedSeats.push(item.seatCode);
      }

      const rawPrice = VietRail.calculateItemPrice(item);
      const finalPrice = Math.round(rawPrice * (1 - VietRail.state.voucherDiscountRate));

      VietRail.state.bookings.unshift({
        ticketId: "VR" + Math.floor(10000 + Math.random() * 90000),
        trainId: item.trainId,
        route: item.route,
        date: item.date,
        departTime: item.departTime,
        coach: item.coach,
        seatCode: item.seatCode,
        passengerName: name,
        cccd,
        phone,
        email,
        passengerType: item.passengerType,
        finalPrice,
        status: "Đã thanh toán"
      });
    });

    VietRail.state.cart = [];
    VietRail.state.voucherDiscountRate = 0;
    VietRail.stopHoldTimer();
    VietRail.saveStorage();

    this.reset();
    document.getElementById("voucher-input").value = "";
    document.getElementById("voucher-msg").textContent = "";

    VietRail.filterAndRenderTrains();
    VietRail.renderSeatMap();
    VietRail.renderCart();
    VietRail.showToast("🎉 Đặt vé thành công! Bạn có thể xem và in vé QR ở Tab 2.");
  });
});