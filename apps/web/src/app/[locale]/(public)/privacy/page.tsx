export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 2, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">1. Information We Collect</h2>
          <p>We collect the following information when you use TorUp:</p>
          <ul className="list-disc ps-6 space-y-2 mt-2">
            <li><strong>Personal information:</strong> Name, phone number, email address</li>
            <li><strong>Appointment data:</strong> Booking details, service preferences, scheduling history</li>
            <li><strong>Business information:</strong> Business name, address, services offered, working hours</li>
            <li><strong>Communication data:</strong> WhatsApp messages related to appointment management</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">2. How We Use Your Information</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li>To manage and schedule appointments</li>
            <li>To send appointment confirmations, reminders, and notifications via WhatsApp</li>
            <li>To provide customer support</li>
            <li>To improve our services</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Data Sharing</h2>
          <p>We do not sell your personal data to third parties. We share data only with:</p>
          <ul className="list-disc ps-6 space-y-2 mt-2">
            <li><strong>Meta WhatsApp API:</strong> To send and receive WhatsApp messages for appointment management</li>
            <li><strong>Service providers:</strong> Cloud hosting and database services necessary to operate the platform</li>
            <li><strong>Business owners:</strong> Your appointment data is shared with the business you book with</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to
            provide services. You may request deletion of your data at any time. Appointment
            history may be retained for up to 12 months for business reporting purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Your Rights</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li><strong>Access:</strong> You can request a copy of your personal data</li>
            <li><strong>Correction:</strong> You can request correction of inaccurate data</li>
            <li><strong>Deletion:</strong> You can request deletion of your personal data</li>
            <li><strong>Portability:</strong> You can request your data in a machine-readable format</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your
            personal data, including encryption, access controls, and secure data storage.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Contact</h2>
          <p>
            For questions about this privacy policy or to exercise your data rights, contact us at{" "}
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
