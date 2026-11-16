import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import CameraPage from "./pages/CameraPage";
import FilterStudio from "./pages/FilterStudio";
import PhotostripEditor from "./pages/PhotostripEditor";
import ResultPage from "./pages/ResultPage";
import GalleryPage from "./pages/GalleryPage";
import EducationPage from "./pages/EducationPage";
import RemoteCameraPage from "./pages/RemoteCameraPage";
import DownloadPage from "./pages/DownloadPage";

export default function App() {
  const location = useLocation();
  const isRemote = location.pathname.includes("/remote-camera");
  const isDownload = location.pathname.includes("/download");

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {!isRemote && !isDownload && <Navbar />}
      <div className={isRemote || isDownload ? "" : "pt-14"}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/camera" element={<CameraPage />} />
            <Route path="/studio" element={<FilterStudio />} />
            <Route path="/photostrip" element={<PhotostripEditor />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/education" element={<EducationPage />} />
            <Route path="/remote-camera" element={<RemoteCameraPage />} />
            <Route path="/download" element={<DownloadPage />} />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  );
}
