import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <span className="text-2xl font-bold text-green-700">Got Dirt</span>
        <div className="flex gap-4">
          <Link href="/map" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
            Find Pits
          </Link>
          <Link
            href="/login"
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 bg-gradient-to-b from-green-50 to-white">
        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6 text-balance">
          Find Dirt Pits <span className="text-green-600">Near You</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mb-10 text-balance">
          The fastest way for contractors and truck drivers to locate borrow pits
          and waste pits across Georgia. View rates, check availability, and pay
          — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/map"
            className="bg-green-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
          >
            Open the Map
          </Link>
          <Link
            href="/register"
            className="border-2 border-green-600 text-green-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-green-50 transition-colors"
          >
            List Your Pit
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              icon: "📍",
              title: "Find Pits",
              desc: "Search by location. See borrow pits, waste pits, or both — on a satellite map.",
            },
            {
              icon: "🟢",
              title: "Check Availability",
              desc: "Green pin means open. Red pin means full. Rates shown right on the map.",
            },
            {
              icon: "💳",
              title: "Pay & Go",
              desc: "Pay per load directly through the app. Pit owners get paid instantly.",
            },
          ].map((item) => (
            <div key={item.title} className="text-center p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pit types */}
      <section className="py-20 px-6 bg-gray-50">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Pit Types</h2>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              type: "Waste Pit",
              color: "bg-orange-100 text-orange-800",
              desc: "Accepts material for disposal. Pay a dump rate per load.",
            },
            {
              type: "Borrow Pit",
              color: "bg-blue-100 text-blue-800",
              desc: "Material available for pickup. Pay a borrow rate per load.",
            },
            {
              type: "Waste & Borrow",
              color: "bg-purple-100 text-purple-800",
              desc: "Both dump and pickup available on the same site.",
            },
          ].map((item) => (
            <div key={item.type} className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${item.color}`}>
                {item.type}
              </span>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA for pit owners */}
      <section className="py-16 px-6 bg-green-700 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Own a Dirt Pit?</h2>
        <p className="text-green-100 mb-8 text-lg max-w-xl mx-auto">
          List your pit and start earning. Set your own rates. We handle payments and invoicing.
        </p>
        <Link
          href="/register"
          className="bg-white text-green-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-green-50 transition-colors shadow"
        >
          Get Started Free
        </Link>
      </section>

      <footer className="py-8 px-6 border-t border-gray-200 text-center text-gray-400 text-sm">
        © {new Date().getFullYear()} Got Dirt. All rights reserved.
      </footer>
    </main>
  );
}
