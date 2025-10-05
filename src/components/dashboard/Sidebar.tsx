import React from 'react';

const navigationIcons = [
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/74a5a3bb99d34acd298a0f1787a9fa18360e18bb?placeholderIfAbsent=true",
    alt: "Dashboard",
    className: "aspect-[0.98] object-contain w-[61px]"
  },
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/b4689e801cedfb02981872c6718b42b58a3ce1b1?placeholderIfAbsent=true",
    alt: "Menu item 1",
    className: "aspect-[1] object-contain w-[33px] self-center mt-[57px] max-md:mt-10"
  },
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/0ad6a992281bfd96bc74b5a0c36f62b8eaa989cb?placeholderIfAbsent=true",
    alt: "Menu item 2",
    className: "aspect-[1] object-contain w-[33px] mt-[57px] max-md:mt-10"
  },
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/a11638ea765c166d6b6887337e12414a034be160?placeholderIfAbsent=true",
    alt: "Menu item 3",
    className: "aspect-[1] object-contain w-8 mt-[57px] max-md:mt-10"
  }
];

const bottomIcons = [
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/13a5f8024de39374c13fa156ca036db8174c10cf?placeholderIfAbsent=true",
    alt: "Bottom menu 1",
    className: "aspect-[1] object-contain w-full"
  },
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/d1140a61e14d69cdec501dbb01c44c9d018c3324?placeholderIfAbsent=true",
    alt: "Bottom menu 2",
    className: "aspect-[1] object-contain w-full mt-[57px] max-md:mt-10"
  },
  {
    src: "https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/766d71d1be7403893ff983bb633787e57d7c955f?placeholderIfAbsent=true",
    alt: "Bottom menu 3",
    className: "aspect-[1] object-contain w-full mt-[57px] max-md:mt-10"
  }
];

export const Sidebar: React.FC = () => {
  return (
    <nav className="bg-[rgba(240,240,240,1)] self-stretch flex flex-col items-center pt-[58px] pb-32 px-6 rounded-[0px_32px_0px_0px] max-md:pb-[100px] max-md:px-5">
      <div className="self-stretch flex flex-col items-stretch">
        {navigationIcons.map((icon, index) => (
          <button
            key={index}
            className="focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg p-1 hover:bg-gray-200 transition-colors"
            aria-label={icon.alt}
          >
            <img
              src={icon.src}
              alt={icon.alt}
              className={icon.className}
            />
          </button>
        ))}
      </div>
      
      <div className="w-[34px] mt-[57px] max-md:mt-10">
        {bottomIcons.map((icon, index) => (
          <button
            key={index}
            className="focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg p-1 hover:bg-gray-200 transition-colors block w-full"
            aria-label={icon.alt}
          >
            <img
              src={icon.src}
              alt={icon.alt}
              className={icon.className}
            />
          </button>
        ))}
      </div>
      
      <button
        className="focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg p-1 hover:bg-gray-200 transition-colors mt-[57px] max-md:mt-10"
        aria-label="Settings"
      >
        <img
          src="https://api.builder.io/api/v1/image/assets/a8745fae349148d29c592f7172b9153a/576e79d29951748b6a3ee2da346a0c0a81e182b2?placeholderIfAbsent=true"
          alt="Settings"
          className="aspect-[1] object-contain w-8"
        />
      </button>
    </nav>
  );
};
