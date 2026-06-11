import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroPage from "@/components/HeroPage";
import MiddleNav from "@/components/MiddleNav";
import PillarPage from "@/components/PillarPage";
import MedusaMiddle from "@/components/MedusaMiddle";
import SlashScreenInfo from "@/components/SlashScreenInfo";
import BlackWhiteNav from "@/components/BlackWhiteNav";
import ShowBodiesPage from "@/components/ShowBodiesPage";

export default function Home() {
  return (
    <>
      <Header />
      <HeroPage />
      <MiddleNav />
      <PillarPage />
      <MedusaMiddle />
      <SlashScreenInfo />
      <BlackWhiteNav />
      <ShowBodiesPage />
      <MiddleNav />
      <Footer />
    </>
  );
}
