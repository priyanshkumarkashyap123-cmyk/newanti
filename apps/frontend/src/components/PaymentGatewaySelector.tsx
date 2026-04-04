import React from 'react';
import { RazorpayPaymentModal } from './RazorpayPayment';
import { type PaidPlanId, type BillingCycle } from '../config/pricing';

export interface PaymentGatewaySelectorProps {
  userId: string;
  email: string;
  userName?: string;
  planId?: PaidPlanId;
  billingCycle?: BillingCycle;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  allowPlanToggle?: boolean;
}

export const PaymentGatewaySelector: React.FC<PaymentGatewaySelectorProps> = (props) => {
  return (
    <RazorpayPaymentModal
      {...props}
      onClose={props.onClose}
    />
  );
};
