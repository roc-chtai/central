
document.addEventListener("DOMContentLoaded", function () {
  // 最新活動（使用獨立按鈕）
  new Swiper('.mySwiper', {
    navigation: {
      nextEl: '.next-mySwiper',
      prevEl: '.prev-mySwiper'
    },
    autoplay: {
      delay: 8000,
      disableOnInteraction: false
    },
    loop: true,
    spaceBetween: 24,
    grabCursor: true,
    breakpoints: {
      0: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 }
    }
  });

  // 推廣活動
  new Swiper('.promoSwiper', {
    navigation: {
      nextEl: '.next-promoSwiper',
      prevEl: '.prev-promoSwiper'
    },
    loop: true,
    spaceBetween: 24,
    grabCursor: true,
    breakpoints: {
      0: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 }
    }
  });

  // 技術活動
  new Swiper('.techSwiper', {
    navigation: {
      nextEl: '.next-techSwiper',
      prevEl: '.prev-techSwiper'
    },
    loop: true,
    spaceBetween: 24,
    grabCursor: true,
    breakpoints: {
      0: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 }
    }
  });
});
