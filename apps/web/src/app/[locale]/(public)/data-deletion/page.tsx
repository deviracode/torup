export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Data Deletion</h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">How to Request Data Deletion</h2>
          <p>
            If you would like to delete your personal data from TorUp, you can submit a deletion
            request by sending an email to{" "}
            <a href="mailto:adamazz1993@gmail.com" className="text-blue-600 hover:underline">
              adamazz1993@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">What to Include</h2>
          <p>Please include the following in your email:</p>
          <ul className="list-disc ps-6 space-y-2 mt-2">
            <li>The email address or phone number associated with your account</li>
            <li>A brief statement requesting data deletion</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">What Happens Next</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li>We will verify your identity and process your request.</li>
            <li>
              All personal data associated with your account will be permanently deleted within
              30 days of receiving your request.
            </li>
            <li>
              This includes your name, phone number, email, appointment history, and any other
              data stored on our platform.
            </li>
            <li>Once deleted, this action cannot be undone.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">Contact</h2>
          <p>
            If you have any questions about data deletion, reach out to us at{" "}
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
