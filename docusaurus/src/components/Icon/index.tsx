import {icons, type LucideProps} from 'lucide-react';

type IconName = keyof typeof icons;

type Props = LucideProps & {
  name: IconName;
};

export default function Icon({name, size = 18, strokeWidth = 1.75, ...rest}: Props) {
  const Component = icons[name];
  if (!Component) return null;
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}
