document.addEventListener("DOMContentLoaded", function () {
  //  最新活動
  new Swiper('.mySwiper', {
    navigation: {
      nextEl: '.mySwiper .swiper-button-next',
      prevEl: '.mySwiper .swiper-button-prev'
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

  // 🛠 技術活動（已加 loop: true）
  new Swiper('.techSwiper', {
    navigation: {
      nextEl: '.techSwiper .swiper-button-next',
      prevEl: '.techSwiper .swiper-button-prev'
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

  //  推廣活動
  new Swiper('.promoSwiper', {
    navigation: {
      nextEl: '.promoSwiper .swiper-button-next',
      prevEl: '.promoSwiper .swiper-button-prev'
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
