import * as React from 'react';
import { Button, Card, Alert, RadixTabs, TabsList, TabsTrigger, TabsContent } from './';

export function UiKitProofOfConcept() {
  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-xl font-bold">UI Kit Proof of Concept</h2>

      <Alert variant="info" className="p-4">
        This is a roadmap component demonstrating how to use the existing Tailwind + Radix components as a new UI layer. It can evolve into a separate "design system" view.
      </Alert>

      <div className="flex items-center gap-2">
        <Button>Primary action</Button>
        <Button variant="secondary">Secondary action</Button>
        <Button variant="destructive">Destructive action</Button>
      </div>

      <RadixTabs defaultValue="usage" className="space-y-3">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="theme">Design tokens</TabsTrigger>
        </TabsList>
        <TabsContent value="usage">
          <p className="text-sm text-slate-600">Components are imported from the shared UI entrypoint and can be updated in one place.</p>
        </TabsContent>
        <TabsContent value="theme">
          <ul className="text-sm text-slate-600 list-disc pl-5">
            <li>Color/spacing tokens in ThemeProvider</li>
            <li>Responsive class variants with Tailwind</li>
            <li>Stateful support: dark mode, pending, etc.</li>
          </ul>
        </TabsContent>
      </RadixTabs>
    </Card>
  );
}
