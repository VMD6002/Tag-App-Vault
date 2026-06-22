import { Link } from "wouter";

export default function PageNotFound() {
  return (
    <div className="h-[calc(100vh-8rem)] grid place-items-center">
      <div className="text-center font-mono">
        <h1 className="text-8xl font-bold">404</h1>
        <span className="text-2xl mb-2 font-stretch-extra-condensed">
          Page Not Found
        </span>
        <br />
        <span className="text-base font-sans">
          Back to{" "}
          <Link to="/" className={"underline"}>
            Library
          </Link>
        </span>
      </div>
    </div>
  );
}
