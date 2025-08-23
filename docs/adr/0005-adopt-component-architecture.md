# ADR-0005: Adopt Component-Based Architecture with Radix UI

## Status
Accepted

## Date
2024-01-28

## Context

The QuickBooks Analyzer application requires a sophisticated user interface that can:

- Display complex financial data in an intuitive, accessible manner
- Maintain consistency across dozens of different views and workflows
- Support rapid feature development and iteration
- Ensure accessibility compliance (WCAG 2.1 AA) for enterprise clients
- Provide professional, polished UI that instills trust in CPAs
- Enable code reusability across different parts of the application
- Support theming and customization for white-label opportunities
- Scale efficiently as the application grows in complexity

The development team needs to balance:
- **Development Speed**: Rapidly build new features without recreating UI elements
- **Consistency**: Uniform look and behavior across the application
- **Accessibility**: Meet enterprise and regulatory accessibility requirements
- **Performance**: Minimize bundle size and render performance
- **Maintainability**: Easy to update and evolve the design system
- **Flexibility**: Customize components for specific use cases

## Decision

We will adopt a component-based architecture using:

- **Radix UI**: Unstyled, accessible component primitives
- **Tailwind CSS**: Utility-first styling system
- **Component Composition**: Small, focused components combined into features
- **Shadcn/ui Pattern**: Copy-paste component approach for full control
- **Custom Component Library**: Domain-specific financial components

### Architecture Structure:
```
src/components/
├── ui/                  # Base UI components (Radix + Tailwind)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── select.tsx
│   └── tabs.tsx
├── charts/             # Financial visualization components
│   └── FinancialChart.tsx
├── dashboard/          # Dashboard-specific components
│   └── DashboardStats.tsx
├── quickbooks/         # QuickBooks integration components
│   └── QuickBooksConnection.tsx
└── reports/            # Report generation components
    └── ReportGeneration.tsx
```

## Alternatives Considered

### 1. Material-UI (MUI)
**Pros:**
- Comprehensive component library
- Google's Material Design principles
- Extensive documentation
- Built-in theming system
- Large community

**Cons:**
- Large bundle size (300KB+ gzipped)
- Opinionated design language
- Complex customization with sx prop
- Performance overhead from CSS-in-JS
- Difficult to achieve unique brand identity
- Material Design may not suit financial applications

### 2. Ant Design (AntD)
**Pros:**
- Enterprise-focused design system
- Rich component set including tables and forms
- Good documentation
- Popular in financial sector
- TypeScript support

**Cons:**
- Very opinionated styling
- Large bundle size
- Difficult to customize deeply
- Chinese-centric defaults
- Less flexible than composable approach
- Occasional breaking changes

### 3. Chakra UI
**Pros:**
- Excellent accessibility defaults
- Modular architecture
- Good TypeScript support
- Built-in dark mode
- Composable components

**Cons:**
- Runtime CSS-in-JS performance cost
- Learning curve for styling system
- Smaller ecosystem
- Less suitable for data-heavy interfaces
- Limited advanced components

### 4. Bootstrap/React-Bootstrap
**Pros:**
- Familiar to many developers
- Mature and stable
- Extensive documentation
- Good browser support
- Quick prototyping

**Cons:**
- Dated design aesthetic
- jQuery heritage shows
- Not React-native approach
- Poor tree-shaking
- Limited customization
- Not accessibility-first

### 5. Custom Component System
**Pros:**
- Complete control
- Perfect fit for requirements
- No external dependencies
- Optimized bundle size

**Cons:**
- 6-12 months development time
- Accessibility expertise required
- Ongoing maintenance burden
- No community support
- Higher bug risk
- Opportunity cost

### 6. Headless UI
**Pros:**
- From Tailwind team
- Unstyled components
- Good accessibility
- Small bundle size

**Cons:**
- Limited component set (10 components)
- Less mature than Radix
- Fewer accessibility features
- Missing critical components for our needs

## Rationale

The Radix UI + Tailwind CSS combination provides optimal benefits:

1. **Accessibility Excellence**:
   - WAI-ARIA compliant out of the box
   - Keyboard navigation handled
   - Screen reader support
   - Focus management
   - Required for enterprise CPA firms

2. **Performance Optimization**:
   - No runtime CSS-in-JS overhead
   - Tree-shakeable components
   - Tailwind purges unused CSS
   - Sub-50KB total UI library size
   - Fast initial load and runtime performance

3. **Developer Velocity**:
   - Shadcn/ui provides ready-to-use patterns
   - Copy-paste gives full control
   - Tailwind utilities speed up styling
   - TypeScript support throughout
   - Excellent IDE integration

4. **Customization Flexibility**:
   - Unstyled primitives allow brand identity
   - Tailwind configuration for design tokens
   - Component variants with CVA
   - Easy to modify copied components
   - White-label ready

5. **Composition Pattern Benefits**:
   - Small, focused components
   - Easy to test in isolation
   - Reusable across features
   - Clear component contracts
   - Predictable behavior

6. **Future-Proof Architecture**:
   - Web standards based
   - No vendor lock-in
   - Components owned by team
   - Easy to migrate if needed
   - Aligns with React best practices

## Consequences

### Positive Consequences

1. **Rapid UI Development**: Build features 50% faster with pre-built components
2. **Consistency**: Design system ensures uniform UX across application
3. **Accessibility**: WCAG 2.1 AA compliance without extra effort
4. **Performance**: Small bundle size and optimal runtime performance
5. **Maintainability**: Centralized components easy to update
6. **Testing**: Component isolation simplifies unit testing
7. **Documentation**: Self-documenting through TypeScript and props
8. **Customization**: Full control over every component
9. **Team Scalability**: New developers productive quickly

### Negative Consequences

1. **Initial Setup Time**: Need to establish component library
2. **Learning Curve**: Team must learn Radix patterns and Tailwind
3. **Copy-Paste Overhead**: Shadcn pattern requires manual updates
4. **Styling Discipline**: Tailwind requires consistent usage patterns
5. **Component Maintenance**: Team owns all copied components
6. **Limited Components**: Need to build domain-specific components

## Implementation Considerations

### Component Structure Example
```typescript
// Base UI Component (ui/button.tsx)
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### Domain Component Example
```typescript
// Financial Component (charts/FinancialChart.tsx)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

export function FinancialChart({ data, title, metrics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={metrics[0].key}>
          <TabsList>
            {metrics.map(metric => (
              <TabsTrigger key={metric.key} value={metric.key}>
                {metric.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {metrics.map(metric => (
            <TabsContent key={metric.key} value={metric.key}>
              <LineChart width={600} height={300} data={data}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line dataKey={metric.key} stroke={metric.color} />
              </LineChart>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

### Design System Configuration
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#64748b',
          foreground: '#ffffff',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

### Component Testing Strategy
```typescript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('renders with correct variant styles', () => {
    render(<Button variant="outline">Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border', 'border-input');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Accessibility Guidelines
- All interactive components have keyboard support
- ARIA labels for screen readers
- Focus indicators visible
- Color contrast ratios meet WCAG AA
- Error messages associated with inputs
- Loading states announced to screen readers

## Related Decisions

- **ADR-0001**: React components leverage this architecture
- **ADR-0002**: Component state synchronized with Supabase
- **ADR-0004**: AI insights displayed in custom components
- **ADR-0007**: Components optimized for Netlify deployment
- **ADR-0010**: PDF generation uses component rendering

## Component Governance

### Component Lifecycle
1. **Proposal**: Identify need for new component
2. **Design**: Create design specs and API
3. **Implementation**: Build with tests
4. **Review**: Team review for consistency
5. **Documentation**: Add to component library
6. **Maintenance**: Regular updates and improvements

### Quality Standards
- 90% test coverage for UI components
- Accessibility audit for each component
- Performance budget: < 5KB per component
- Documentation with usage examples
- Visual regression testing with Chromatic

## Migration Path

If we need to migrate from this architecture:
1. Components are self-contained and portable
2. Tailwind classes can be converted to CSS modules
3. Radix primitives can be replaced gradually
4. TypeScript interfaces remain valid
5. Tests continue to work with new implementation

## Performance Benchmarks

Component performance targets:
- Initial render: < 16ms (60fps)
- Re-render: < 8ms
- Bundle size per component: < 5KB gzipped
- Total UI library: < 50KB gzipped
- Lighthouse score: > 95

## References

- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)
- [Tailwind CSS Best Practices](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com)
- [Component-Driven Development](https://www.componentdriven.org)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Review and Approval

- **Proposed by**: Technical Lead, UX Designer
- **Reviewed by**: Senior Business Analyst, Accessibility Specialist
- **Approved by**: Project Stakeholders
- **Review Date**: 2024-01-28