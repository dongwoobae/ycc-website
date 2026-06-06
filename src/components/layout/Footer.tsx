export default function Footer() {
  return (
    <footer className="mt-auto bg-gray-800 text-gray-300">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-10 text-sm md:grid-cols-3">
        <div>
          <h3 className="mb-2 font-semibold text-white">영천중앙교회</h3>
          <p>경북 영천시 (주소 입력)</p>
          <p>전화: 000-000-0000</p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-white">예배 시간</h3>
          <p>주일 1부: 오전 9시</p>
          <p>주일 2부: 오전 11시</p>
          <p>수요 예배: 오후 7시 30분</p>
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-white">헌금 계좌</h3>
          <p>은행명 000-000-000000</p>
          <p>예금주: 영천중앙교회</p>
        </div>
      </div>
      <div className="border-t border-gray-700 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} 영천중앙교회. All rights reserved.
      </div>
    </footer>
  )
}
