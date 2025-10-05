import React from 'react';

interface DashboardHeaderProps {
  userName?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ userName = "Samuel" }) => {
  return (
    <header className="flex w-[426px] max-w-full flex-col items-stretch ml-2.5">
      <div className="max-md:max-w-full">
        <div className="gap-5 flex max-md:flex-col max-md:items-stretch">
          <div className="w-[29%] max-md:w-full max-md:ml-0">
            <div className="bg-[rgba(40,1,55,1)] flex flex-col text-[13px] text-white font-normal justify-center w-[110px] h-[110px] mt-1 mx-auto px-[35px] rounded-[50%] max-md:mt-[39px] max-md:px-5">
              <div>logo top aqui</div>
            </div>
          </div>
          <div className="w-[71%] ml-5 max-md:w-full max-md:ml-0">
            <h1 className="text-black text-5xl font-normal max-md:text-[40px] max-md:mt-[35px]">
              Olá <span className="font-bold">{userName}!</span>
            </h1>
          </div>
        </div>
      </div>
      <div className="text-[rgba(94,94,94,1)] text-base font-normal mr-[60px] mt-1 max-md:mr-2.5">
        <span className="font-bold">Últimos</span> chamados abertos:
      </div>
    </header>
  );
};
