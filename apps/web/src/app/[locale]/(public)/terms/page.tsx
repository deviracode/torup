export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 2, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">1. Service Description</h2>
          <p>
            TorUp is a queue and appointment management platform that allows businesses to manage
            bookings, queues, and customer notifications. By using our service, you agree to these
            Terms of Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">2. User Responsibilities</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li>You must provide accurate and up-to-date information when creating an account.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You agree not to misuse the service or use it for any unlawful purpose.</li>
            <li>
              Business users are responsible for obtaining appropriate consent from their customers
              before adding them to the platform.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Intellectual Property</h2>
          <p>
            All content, trademarks, and technology on the TorUp platform are owned by us and
            protected by applicable intellectual property laws. You may not copy, modify, or
            distribute any part of the service without our prior written consent.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Limitation of Liability</h2>
          <p>
            TorUp is provided &quot;as is&quot; without warranties of any kind. We are not liable for
            any indirect, incidental, or consequential damages arising from your use of the service,
            including but not limited to missed appointments, lost data, or service interruptions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time if you violate
            these terms. You may also delete your account at any time by contacting us. Upon
            termination, your data will be deleted in accordance with our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Changes to Terms</h2>
          <p>
            We may update these Terms of Service from time to time. Continued use of the service
            after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Governing Law</h2>
          <p>
            These terms are governed by and construed in accordance with the laws of the State of
            Israel. Any disputes shall be subject to the exclusive jurisdiction of the courts in
            Israel.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">8. Contact</h2>
          <p>
            For questions about these terms, contact us at{" "}
            <a href="mailto:adamazz1993@gmail.com" className="text-blue-600 hover:underline">
              adamazz1993@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
