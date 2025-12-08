import Footer from 'components/Footer';
import Header from 'components/Header';
import { Outlet } from 'react-router-dom';

export const PageTemplate = () => (
  <div className="h-full flex flex-col text-white">
    <Header />
    <div className="flex flex-col p-4 md:p-10 flex-1">
      <Outlet />
    </div>
    <Footer />
  </div>
);

export default PageTemplate;
