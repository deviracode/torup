"use client";

import { useTranslations } from "next-intl";

export default function BillingPage() {
  const tNav = useTranslations("nav");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{tNav("billing")}</h1>

      <div className="space-y-6">
        {/* Current Plan */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Current Plan</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">Professional</p>
              <p className="text-sm text-gray-500 mt-1">₪149/month</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">Active</span>
          </div>
        </div>

        {/* Plan Features */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Plan Features</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Up to 5 staff members</li>
            <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Unlimited appointments</li>
            <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> WhatsApp agent</li>
            <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Web booking page</li>
            <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Analytics dashboard</li>
          </ul>
        </div>

        {/* Upgrade CTA */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="font-semibold">Need more?</h3>
          <p className="text-sm text-gray-600 mt-1">
            Upgrade to Business plan for unlimited staff and priority support.
          </p>
          <button className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700">
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
