document.addEventListener("DOMContentLoaded", function () {
  // ====== 判斷螢幕寬度，決定要不要 loop ======
  const width = window.innerWidth;
  const isDesktop = width >= 992;

  // Swiper 共用參數
  const commonSettings = {
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev'
    },
    slidesPerGroup: 1,
    loopAdditionalSlides: 1,
    spaceBetween: 24,
    grabCursor: true,
    watchOverflow: true,
    breakpoints: {
      0:   { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 }
    }
  };

  // loop: 手機/平板啟用，桌機停用
  const settings = { ...commonSettings, loop: !isDesktop };

  // 三組輪播都用同一組設定
  new Swiper('.mySwiper', settings);
  new Swiper('.promoSwiper', settings);
  new Swiper('.techSwiper', settings);

  // ====== 導覽列漢堡選單事件（原本的功能）======
  const menuIcon = document.getElementById('menu-icon');
  const navIcons = document.getElementById('nav-icons');
  if(menuIcon && navIcons){
    menuIcon.addEventListener('click', () => {
      navIcons.classList.toggle('show');
      menuIcon.classList.toggle('active');
    });
  }

  // ====== 桌機 icon-btn hover 換圖片功能 ======
  if (window.innerWidth > 760) {
    document.querySelectorAll('.icon-btn').forEach(button => {
      const img = button.querySelector('img');
      if (!img) return;
      const originalSrc = img.getAttribute('src');
      if (originalSrc.endsWith('.png')) {
        const hoverSrc = originalSrc.replace('.png', '_b.png');
        button.addEventListener('mouseenter', () => { img.src = hoverSrc; });
        button.addEventListener('mouseleave', () => { img.src = originalSrc; });
      }
    });
  }
});
