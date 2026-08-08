import DriverHomeClient from "./DriverHomeClient";

/**
 * 기사님 앱의 시작 주소(/driver).
 *
 * 이 페이지가 없어서 앱을 설치해도 홈 화면 아이콘이 404 를 열고 있었다.
 * manifest 의 start_url 은 반드시 실제로 열리는 주소여야 한다.
 */
export default function DriverHomePage() {
  return <DriverHomeClient />;
}
